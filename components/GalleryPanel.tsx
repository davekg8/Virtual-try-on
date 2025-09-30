/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { SavedOutfit } from '../types';
import { Trash2Icon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';

interface GalleryPanelProps {
  outfits: SavedOutfit[];
  onDelete: (id: string) => void;
}

const GalleryPanel: React.FC<GalleryPanelProps> = ({ outfits, onDelete }) => {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-4">Saved Outfits</h2>
      {outfits.length === 0 ? (
        <div className="flex-grow flex items-center justify-center">
            <p className="text-center text-sm text-gray-500 p-4">
                Your saved outfits will appear here.
                <br />
                Create an outfit and click 'Save' to add it to your gallery.
            </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence>
            {outfits.map((outfit) => (
              <motion.div
                key={outfit.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200"
              >
                <img src={outfit.thumbnailUrl} alt="Saved outfit" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                      onClick={() => onDelete(outfit.id)}
                      className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full text-red-600 hover:bg-white"
                      aria-label="Delete outfit"
                  >
                      <Trash2Icon className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default GalleryPanel;
