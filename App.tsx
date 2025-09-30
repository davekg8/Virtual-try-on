/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import GalleryPanel from './components/GalleryPanel';
import { generateVirtualTryOnImage, generatePoseVariation, changeGarmentColor } from './services/geminiService';
import { OutfitLayer, WardrobeItem, SavedOutfit } from './types';
import { ChevronDownIcon, ChevronUpIcon, WandIcon, GalleryHorizontalIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage, urlToFile } from './lib/utils';
import Spinner from './components/Spinner';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Jumping in the air, mid-action shot",
  "Walking towards camera",
  "Leaning against a wall",
  "Sitting on the floor",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', listener);
    
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};


const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [outfitHistory, setOutfitHistory] = useState<OutfitLayer[]>([]);
  const [currentOutfitIndex, setCurrentOutfitIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'gallery'>('editor');
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    try {
      const storedOutfits = localStorage.getItem('saved-outfits');
      if (storedOutfits) {
        setSavedOutfits(JSON.parse(storedOutfits));
      }
    } catch (error) {
      console.error("Failed to load saved outfits from localStorage:", error);
    }
  }, []);

  const activeOutfitLayers = useMemo(() => 
    outfitHistory.slice(0, currentOutfitIndex + 1), 
    [outfitHistory, currentOutfitIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeOutfitLayers.map(layer => layer.garment?.id).filter(Boolean) as string[], 
    [activeOutfitLayers]
  );
  
  const displayImageUrl = useMemo(() => {
    if (outfitHistory.length === 0) return modelImageUrl;
    const currentLayer = outfitHistory[currentOutfitIndex];
    if (!currentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    return currentLayer.poseImages[poseInstruction] ?? Object.values(currentLayer.poseImages)[0];
  }, [outfitHistory, currentOutfitIndex, currentPoseIndex, modelImageUrl]);

  const availablePoseKeys = useMemo(() => {
    if (outfitHistory.length === 0) return [];
    const currentLayer = outfitHistory[currentOutfitIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [outfitHistory, currentOutfitIndex]);

  const canRegenerate = useMemo(() => currentOutfitIndex > 0, [currentOutfitIndex]);


  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setOutfitHistory([{
      garment: null,
      poseImages: { [POSE_INSTRUCTIONS[0]]: url }
    }]);
    setCurrentOutfitIndex(0);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setOutfitHistory([]);
    setCurrentOutfitIndex(0);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setCurrentPoseIndex(0);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    setActiveTab('editor');
  };
  
  const handleDownloadImage = useCallback(() => {
    if (!displayImageUrl) return;
    const link = document.createElement('a');
    link.href = displayImageUrl;
    link.download = `virtual-try-on-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [displayImageUrl]);

  const handleSaveOutfit = useCallback(() => {
    if (!displayImageUrl || activeOutfitLayers.length <= 1) {
        console.warn("Cannot save an outfit with only the base model.");
        return;
    }

    const newSavedOutfit: SavedOutfit = {
        id: `outfit-${Date.now()}`,
        thumbnailUrl: displayImageUrl,
        layers: activeOutfitLayers,
        createdAt: new Date().toISOString(),
    };

    setSavedOutfits(prev => {
        const updatedOutfits = [newSavedOutfit, ...prev];
        try {
            localStorage.setItem('saved-outfits', JSON.stringify(updatedOutfits));
        } catch (error) {
            console.error("Failed to save outfits to localStorage:", error);
            setError("Could not save outfit. Your browser's storage might be full.");
        }
        return updatedOutfits;
    });
    
    setActiveTab('gallery');
  }, [displayImageUrl, activeOutfitLayers]);

  const handleDeleteOutfit = useCallback((outfitId: string) => {
    setSavedOutfits(prev => {
        const updatedOutfits = prev.filter(outfit => outfit.id !== outfitId);
        try {
            localStorage.setItem('saved-outfits', JSON.stringify(updatedOutfits));
        } catch (error) {
            console.error("Failed to update localStorage after deletion:", error);
            setError("Could not delete outfit. Please try again.");
        }
        return updatedOutfits;
    });
  }, []);

  const handleGarmentSelect = useCallback(async (garmentFile: File, garmentInfo: WardrobeItem) => {
    if (!displayImageUrl || isLoading) return;

    const nextLayer = outfitHistory[currentOutfitIndex + 1];
    if (nextLayer && nextLayer.garment?.id === garmentInfo.id) {
        setCurrentOutfitIndex(prev => prev + 1);
        setCurrentPoseIndex(0);
        return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Adding ${garmentInfo.name}...`);

    try {
      const newImageUrl = await generateVirtualTryOnImage(displayImageUrl, garmentFile);
      const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
      
      const newLayer: OutfitLayer = { 
        garment: garmentInfo, 
        poseImages: { [currentPoseInstruction]: newImageUrl } 
      };

      setOutfitHistory(prevHistory => {
        const newHistory = prevHistory.slice(0, currentOutfitIndex + 1);
        return [...newHistory, newLayer];
      });
      setCurrentOutfitIndex(prev => prev + 1);
      
      setWardrobe(prev => {
        if (prev.find(item => item.id === garmentInfo.id)) {
            return prev;
        }
        return [...prev, garmentInfo];
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to apply garment'));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [displayImageUrl, isLoading, currentPoseIndex, outfitHistory, currentOutfitIndex]);

  const handleRemoveLastGarment = () => {
    if (currentOutfitIndex > 0) {
      setCurrentOutfitIndex(prevIndex => prevIndex - 1);
      setCurrentPoseIndex(0);
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || outfitHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = outfitHistory[currentOutfitIndex];

    if (currentLayer.poseImages[poseInstruction]) {
      setCurrentPoseIndex(newIndex);
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    const prevPoseIndex = currentPoseIndex;
    setCurrentPoseIndex(newIndex);

    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      setOutfitHistory(prevHistory => {
        const newHistory = [...prevHistory];
        const updatedLayer = newHistory[currentOutfitIndex];
        updatedLayer.poseImages[poseInstruction] = newImageUrl;
        return newHistory;
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      setCurrentPoseIndex(prevPoseIndex);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, outfitHistory, isLoading, currentOutfitIndex]);
  
  const handleRegenerateImage = useCallback(async () => {
    if (isLoading || currentOutfitIndex === 0) return;

    const currentLayer = outfitHistory[currentOutfitIndex];
    const previousLayer = outfitHistory[currentOutfitIndex - 1];
    const garmentInfo = currentLayer.garment;

    if (!garmentInfo) return;

    const baseModelImage = Object.values(previousLayer.poseImages)[0];
    if (!baseModelImage) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Regenerating ${garmentInfo.name}...`);

    try {
        const garmentFile = await urlToFile(garmentInfo.url, garmentInfo.name);
        const newImageUrl = await generateVirtualTryOnImage(baseModelImage, garmentFile);
        
        const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];

        setOutfitHistory(prevHistory => {
            const newHistory = [...prevHistory];
            const updatedLayer = { ...newHistory[currentOutfitIndex] };
            updatedLayer.poseImages[currentPoseInstruction] = newImageUrl;
            newHistory[currentOutfitIndex] = updatedLayer;
            return newHistory;
        });
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to regenerate image'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [isLoading, currentOutfitIndex, outfitHistory, currentPoseIndex]);

  const handleChangeColor = useCallback(async (newColor: string) => {
    if (isLoading || currentOutfitIndex === 0) return;

    const currentLayer = outfitHistory[currentOutfitIndex];
    const garmentInfo = currentLayer.garment;
    if (!garmentInfo) return;

    const baseImageForColorChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForColorChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing color to ${newColor}...`);

    try {
        const newImageUrl = await changeGarmentColor(baseImageForColorChange, garmentInfo.name, newColor);
        const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];

        setOutfitHistory(prevHistory => {
            const newHistory = [...prevHistory];
            const newLayer: OutfitLayer = {
                garment: garmentInfo,
                poseImages: { [currentPoseInstruction]: newImageUrl }
            };
            newHistory[currentOutfitIndex] = newLayer;
            return newHistory;
        });
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to change color'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [isLoading, currentOutfitIndex, outfitHistory, currentPoseIndex]);


  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  const tabContentVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
  }

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onDownloadImage={handleDownloadImage}
                  onRegenerate={handleRegenerateImage}
                  canRegenerate={canRegenerate}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  
                  <div className="px-4 md:px-6 pt-4">
                    <div className="flex w-full bg-gray-200/70 rounded-lg p-1 space-x-1">
                        <button
                          onClick={() => setActiveTab('editor')}
                          className={`w-1/2 flex items-center justify-center rounded-md py-1.5 text-sm font-semibold transition-colors ${activeTab === 'editor' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-600 hover:bg-white/50'}`}
                        >
                          <WandIcon className="w-4 h-4 mr-2" />
                          Editor
                        </button>
                        <button
                          onClick={() => setActiveTab('gallery')}
                          className={`w-1/2 flex items-center justify-center rounded-md py-1.5 text-sm font-semibold transition-colors ${activeTab === 'gallery' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-600 hover:bg-white/50'}`}
                        >
                          <GalleryHorizontalIcon className="w-4 h-4 mr-2" />
                          Gallery
                        </button>
                    </div>
                  </div>

                  <div className="p-4 md:px-6 md:pt-4 pb-20 overflow-y-auto flex-grow">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <AnimatePresence mode="wait">
                      {activeTab === 'editor' ? (
                          <motion.div 
                            key="editor"
                            variants={tabContentVariants}
                            initial="initial" animate="animate" exit="exit"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="flex flex-col gap-8"
                          >
                            <OutfitStack 
                              outfitHistory={activeOutfitLayers}
                              onRemoveLastGarment={handleRemoveLastGarment}
                              onSaveOutfit={handleSaveOutfit}
                              onChangeColor={handleChangeColor}
                            />
                            <WardrobePanel
                              onGarmentSelect={handleGarmentSelect}
                              activeGarmentIds={activeGarmentIds}
                              isLoading={isLoading}
                              wardrobe={wardrobe}
                            />
                          </motion.div>
                      ) : (
                          <motion.div 
                            key="gallery"
                            variants={tabContentVariants}
                            initial="initial" animate="animate" exit="exit"
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                          >
                              <GalleryPanel outfits={savedOutfits} onDelete={handleDeleteOutfit} />
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && (
                    <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;