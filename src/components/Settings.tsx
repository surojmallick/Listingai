import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Save, Loader2, Key, Zap, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [preferredModel, setPreferredModel] = useState<'gemini' | 'openai'>('gemini');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      try {
        const savedSettings = localStorage.getItem('ecom_seo_settings');
        if (savedSettings) {
          const data = JSON.parse(savedSettings);
          setGeminiKey(data.geminiApiKey || '');
          setOpenaiKey(data.openaiApiKey || '');
          setPreferredModel(data.preferredModel || 'gemini');
        }
      } catch (err: any) {
        console.error("Failed to load settings:", err);
        setError("Failed to load settings from local storage.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const settings = {
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        preferredModel: preferredModel
      };
      localStorage.setItem('ecom_seo_settings', JSON.stringify(settings));
      
      // Small delay to show saving state
      await new Promise(resolve => setTimeout(resolve, 500));
      onClose();
    } catch (err: any) {
      setError("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <Loader2 className="text-white animate-spin" size={40} />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
              <p className="text-slate-500 text-sm mt-1">Configure your API keys and preferences</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Preferred Model</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPreferredModel('gemini')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 transition-all font-bold text-sm",
                    preferredModel === 'gemini' 
                      ? "bg-indigo-50 border-indigo-500 text-indigo-600" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  <Sparkles size={18} />
                  Gemini
                </button>
                <button
                  onClick={() => setPreferredModel('openai')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 transition-all font-bold text-sm",
                    preferredModel === 'openai' 
                      ? "bg-indigo-50 border-indigo-500 text-indigo-600" 
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  <Zap size={18} />
                  ChatGPT
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Gemini API Key (Optional)</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                  placeholder="Enter your Gemini API key"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">Leave empty to use the default system key.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">ChatGPT API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                  placeholder="Enter your OpenAI API key"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">Required if you select ChatGPT as your preferred model.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4"
            >
              {isSaving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
