import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../src/lib/firebase';
import Card, { CardTitle } from './Card';
import { Search, MessageSquare, Send, X, Trash2 } from 'lucide-react';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

interface Plot {
  id: string;
  userId: string;
  userName: string;
  timestamp: number;
  projectId: string;
  imageData: string;
  description: string;
  location?: string;
  festival?: string;
  stage?: string;
  notes?: string;
  comments?: Comment[];
  rawScanData?: string; // JSON stringified ScanDataPoint[]
}

interface PlotGalleryProps {
  onImportScanData?: (data: any[]) => void;
}

const PlotGallery: React.FC<PlotGalleryProps> = ({ onImportScanData }) => {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [plotToDelete, setPlotToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'plots'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plotsData: Plot[] = [];
      snapshot.forEach((doc) => {
        plotsData.push({ id: doc.id, ...doc.data() } as Plot);
      });
      setPlots(plotsData);
      
      // Update selected plot if it changes
      setSelectedPlot(current => {
        if (!current) return null;
        const updated = plotsData.find(p => p.id === current.id);
        return updated || null;
      });
    });
    return () => unsubscribe();
  }, []);

  const confirmDelete = async () => {
    if (!plotToDelete) return;
    try {
      await deleteDoc(doc(db, 'plots', plotToDelete));
      if (selectedPlot?.id === plotToDelete) {
        setSelectedPlot(null);
      }
    } catch (error) {
      console.error('Error deleting plot:', error);
    } finally {
      setPlotToDelete(null);
    }
  };

  const handleAddComment = async (plotId: string) => {
    const text = commentInputs[plotId];
    if (!auth.currentUser || !text?.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Anonymous',
      text: text.trim(),
      timestamp: Date.now()
    };

    try {
      await updateDoc(doc(db, 'plots', plotId), {
        comments: arrayUnion(newComment)
      });
      setCommentInputs(prev => ({ ...prev, [plotId]: '' }));
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const filteredPlots = plots.filter(plot => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      plot.description?.toLowerCase().includes(q) ||
      plot.location?.toLowerCase().includes(q) ||
      plot.festival?.toLowerCase().includes(q) ||
      plot.stage?.toLowerCase().includes(q) ||
      plot.notes?.toLowerCase().includes(q) ||
      plot.userName?.toLowerCase().includes(q) ||
      new Date(plot.timestamp).toLocaleDateString().includes(q)
    );
  });

  return (
    <Card className="p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <CardTitle className="!mb-0">Plot Gallery</CardTitle>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by location, festival, stage, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-emerald-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* COMPACT GRID VIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredPlots.map((plot) => (
          <div 
            key={plot.id} 
            onClick={() => setSelectedPlot(plot)}
            className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:border-emerald-500 transition-colors group flex flex-col"
          >
            <div className="relative h-24 bg-black">
              <img src={plot.imageData} alt={plot.description} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
              <h4 className="font-bold text-emerald-400 text-xs truncate" title={plot.festival || plot.location || 'Unnamed Scan'}>
                {plot.festival || plot.location || 'Unnamed Scan'}
              </h4>
              {plot.stage && <p className="text-[10px] text-slate-400 truncate mt-0.5">{plot.stage}</p>}
              
              <div className="mt-auto pt-2 flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-mono">{new Date(plot.timestamp).toLocaleDateString()}</span>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <MessageSquare className="w-3 h-3" /> {plot.comments?.length || 0}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredPlots.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No scans found matching your search.
          </div>
        )}
      </div>

      {/* EXPANDED MODAL VIEW */}
      {selectedPlot && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setSelectedPlot(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Left side: Image */}
            <div className="flex-1 bg-black relative flex items-center justify-center p-4 min-h-[40vh] md:min-h-0">
              <button 
                onClick={() => setSelectedPlot(null)}
                className="absolute top-4 left-4 md:hidden bg-slate-800/80 text-white p-2 rounded-full z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img src={selectedPlot.imageData} alt={selectedPlot.description} className="max-w-full max-h-full object-contain" />
            </div>

            {/* Right side: Details & Comments */}
            <div className="w-full md:w-96 flex flex-col border-l border-slate-800 bg-slate-900 max-h-[50vh] md:max-h-[90vh]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-start shrink-0">
                <div>
                  <h3 className="font-bold text-emerald-400 text-lg">{selectedPlot.festival || selectedPlot.location || 'Live Scan'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-white font-medium">{selectedPlot.userName}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(selectedPlot.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {onImportScanData && selectedPlot.rawScanData && (
                    <button
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(selectedPlot.rawScanData!);
                          onImportScanData(parsed);
                        } catch (e) {
                          console.error("Failed to parse scan data", e);
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-indigo-500/20"
                      title="Import this scan data into your Spectrum Analyzer"
                    >
                      Import to Analyzer
                    </button>
                  )}
                  {auth.currentUser?.uid === selectedPlot.userId && (
                    <button
                      onClick={() => setPlotToDelete(selectedPlot.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Delete Plot"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedPlot(null)}
                    className="hidden md:block text-slate-500 hover:text-white transition-colors p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 border-b border-slate-800 shrink-0 space-y-2">
                {selectedPlot.location && <p className="text-xs text-white"><span className="text-slate-500">Location:</span> {selectedPlot.location}</p>}
                {selectedPlot.stage && <p className="text-xs text-white"><span className="text-slate-500">Stage:</span> {selectedPlot.stage}</p>}
                <p className="text-xs text-slate-400">{selectedPlot.description}</p>
                {selectedPlot.notes && <p className="text-xs text-slate-300 italic mt-2 bg-slate-800/50 p-2 rounded">"{selectedPlot.notes}"</p>}
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Comments ({selectedPlot.comments?.length || 0})
                </h4>
                
                <div className="space-y-3">
                  {selectedPlot.comments?.map(comment => (
                    <div key={comment.id} className="bg-slate-800/50 rounded-lg p-3">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-[11px] font-bold text-emerald-500">{comment.userName}</span>
                        <span className="text-[9px] text-slate-500">{new Date(comment.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-slate-300">{comment.text}</p>
                    </div>
                  ))}
                  {(!selectedPlot.comments || selectedPlot.comments.length === 0) && (
                    <p className="text-sm text-slate-500 italic text-center py-8">No comments yet. Be the first!</p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Add a comment..."
                    value={commentInputs[selectedPlot.id] || ''}
                    onChange={(e) => setCommentInputs(prev => ({ ...prev, [selectedPlot.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(selectedPlot.id)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                  <button 
                    onClick={() => handleAddComment(selectedPlot.id)}
                    disabled={!commentInputs[selectedPlot.id]?.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {plotToDelete && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Plot?</h3>
            <p className="text-slate-400 text-sm mb-6">Are you sure you want to delete this plot? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPlotToDelete(null)} 
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default PlotGallery;
