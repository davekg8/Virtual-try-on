/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { OutfitLayer } from '../types';
import { Trash2Icon, BookmarkIcon, PaletteIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface OutfitStackProps {
  outfitHistory: OutfitLayer[];
  onRemoveLastGarment: () => void;
  onSaveOutfit: () => void;
  onChangeColor: (color: string) => void;
}

const COLORS = ["Red", "Blue", "Green", "Yellow", "Black", "White", "Pink", "Purple"];

const OutfitStack: React.FC<OutfitStackProps> = ({ outfitHistory, onRemoveLastGarment, onSaveOutfit, onChangeColor }) => {
  const [showColorPickerFor, setShowColorPickerFor] = useState<string | null>(null);
  const canSave = outfitHistory.length > 1;

  const handleColorChange = (color: string) => {
    onChangeColor(color);
    setShowColorPickerFor(null);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-400/50 pb-2 mb-3">
        <h2 className="text-xl font-serif tracking-wider text-gray-800">Outfit Stack</h2>
        <button
          onClick={onSaveOutfit}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Save outfit"
        >
            <BookmarkIcon className="w-4 h-4" />
            Save
        </button>
      </div>
      <div className="space-y-2">
        {outfitHistory.map((layer, index) => {
          const isLastItem = index > 0 && index === outfitHistory.length - 1;
          const garmentId = layer.garment?.id || 'base';

          return (
            <motion.div
              key={garmentId}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-gray-200/80">
                <div className="flex items-center overflow-hidden">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 mr-3 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">
                      {index + 1}
                    </span>
                    {layer.garment && (
                        <img src={layer.garment.url} alt={layer.garment.name} className="flex-shrink-0 w-12 h-12 object-cover rounded-md mr-3" />
                    )}
                    <span className="font-semibold text-gray-800 truncate" title={layer.garment?.name}>
                      {layer.garment ? layer.garment.name : 'Base Model'}
                    </span>
                </div>
                <div className="flex items-center flex-shrink-0">
                  {isLastItem && (
                     <button
                        onClick={() => setShowColorPickerFor(showColorPickerFor === garmentId ? null : garmentId)}
                        className="flex-shrink-0 text-gray-500 hover:text-indigo-600 transition-colors p-2 rounded-md hover:bg-indigo-50"
                        aria-label={`Change color of ${layer.garment?.name}`}
                      >
                        <PaletteIcon className="w-5 h-5" />
                      </button>
                  )}
                  {isLastItem && (
                    <button
                      onClick={onRemoveLastGarment}
                      className="flex-shrink-0 text-gray-500 hover:text-red-600 transition-colors p-2 rounded-md hover:bg-red-50"
                      aria-label={`Remove ${layer.garment?.name}`}
                    >
                      <Trash2Icon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {showColorPickerFor === garmentId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: '0.5rem' }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-2 bg-gray-100 rounded-md border border-gray-200/80">
                        <p className="text-xs font-semibold text-gray-600 mb-2 px-1">Change Color</p>
                        <div className="grid grid-cols-4 gap-2">
                            {COLORS.map(color => (
                                <button 
                                    key={color}
                                    onClick={() => handleColorChange(color)}
                                    className="w-full text-center text-xs font-medium p-2 rounded-md transition-transform active:scale-95"
                                    style={{ 
                                      backgroundColor: color.toLowerCase(), 
                                      color: ['black', 'yellow', 'white', 'pink'].includes(color.toLowerCase()) ? '#1f2937' : 'white',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {color}
                                </button>
                            ))}
                        </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {outfitHistory.length === 1 && (
            <p className="text-center text-sm text-gray-500 pt-4">Your stacked items will appear here. Select an item from the wardrobe below.</p>
        )}
      </div>
    </div>
  );
};

export default OutfitStack;
