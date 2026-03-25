import React from 'react';
import { Share2 } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ title, text, url }) => {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all"
    >
      <Share2 size={16} />
      Share
    </button>
  );
};
