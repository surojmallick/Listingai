/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";
import OpenAI from 'openai';
import { 
  ShoppingBag, 
  Upload, 
  Copy, 
  Check, 
  Loader2, 
  Image as ImageIcon, 
  X, 
  Sparkles,
  Zap,
  LayoutGrid,
  ArrowRight,
  Settings as SettingsIcon,
  ChevronDown,
  Trash2,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import Settings from './components/Settings';

// Initialize Default Gemini
const defaultAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Platform = 'meesho' | 'flipkart';

interface GeneratedListing {
  id?: string;
  title: any;
  description: any;
  keywords?: any;
  keyFeatures?: any;
  additionalFeatures?: any;
  productDetails?: string;
  category?: string;
  platform?: Platform;
}

const CATEGORIES = [
  "Jewellery Set",
  "Clothing & Apparel",
  "Electronics & Gadgets",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Footwear",
  "Jewelry & Accessories",
  "Toys & Baby Products",
  "Sports & Outdoors",
  "Automotive",
  "Books & Stationery"
];

export default function App() {
  const [platform, setPlatform] = useState<Platform>('meesho');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [productDetails, setProductDetails] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [listing, setListing] = useState<GeneratedListing | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setImage(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyToClipboard = (content: any, field: string) => {
    const textToCopy = typeof content === 'string' 
      ? content 
      : typeof content === 'object' && content !== null
        ? Object.entries(content)
            .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}: ${value}`)
            .join('\n')
        : String(content || '');

    navigator.clipboard.writeText(textToCopy);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getApiSettings = () => {
    try {
      const savedSettings = localStorage.getItem('ecom_seo_settings');
      return savedSettings ? JSON.parse(savedSettings) : null;
    } catch (err) {
      console.error("Failed to load settings:", err);
      return null;
    }
  };

  const generateListing = async () => {
    if (!productDetails && !image) {
      alert("Please provide product details or an image.");
      return;
    }

    setIsGenerating(true);
    setListing(null);

    try {
      const settings = getApiSettings();
      const preferredModel = settings?.preferredModel || 'gemini';
      const geminiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      const openaiKey = settings?.openaiApiKey;

      const prompt = platform === 'meesho' 
        ? `Act as an expert Meesho seller. Create a high-ranking SEO listing for this product in the "${category}" category. 
           Meesho requirements:
           1. Title: Create a long, keyword-rich title (80-100 characters). DO NOT start with a brand name (e.g., avoid starting with "Sia Svathi" or any other brand). Start with the main product keywords. Include product type, material, and key benefit. Use high-volume search terms.
           2. Description: Extremely detailed, up to 1400 words. Embed high-volume keywords naturally throughout. Use bullet points for readability. Focus on benefits and features.
           3. Keywords: Since Meesho doesn't have a separate keyword field, list 20-30 high-ranking keywords separately at the end of the description AND embed them in the title and description.
           
           CRITICAL CONSTRAINTS:
           - DO NOT mention specific rituals or events (e.g., NO 'Haldi', 'Sangeet', 'Wedding', 'Engagement'). Keep it general to target a large buyer segment.
           - For jewellery, ALWAYS target "Women and Girls" (not just women) in the title, description, and keywords to reach a wider audience.
           - Focus on SEO-friendly content that addresses customer pain points and highlights unique selling propositions.
           Format the response as JSON with keys: "title", "description".`
        : `Act as an expert Flipkart seller. Create a high-ranking SEO listing for this product in the "${category}" category. 
           Flipkart requirements:
           1. Title: Professional, SEO-optimized, and long (70-90 characters). DO NOT start with a brand name (e.g., avoid starting with "Sia Svathi" or any other brand). Start with the main product keywords. Include main keywords and product attributes.
           2. Description: Compelling, clear, and SEO-rich. Highlight benefits over features. Use persuasive language.
           3. Keywords: A comma-separated list of 20+ high-ranking, long-tail keywords.
           4. Key Features: 5-7 bullet points of main selling points, each starting with a benefit.
           5. Additional Features: Technical specs, care instructions, or extra details.
           
           CRITICAL CONSTRAINTS:
           - DO NOT mention specific rituals or events (e.g., NO 'Haldi', 'Sangeet', 'Wedding', 'Engagement'). Keep it general to target a large buyer segment.
           - For jewellery, ALWAYS target "Women and Girls" (not just women) in the title, description, and keywords to reach a wider audience.
           - Focus on high-conversion, SEO-friendly language.
           Format the response as JSON with keys: "title", "description", "keywords", "keyFeatures", "additionalFeatures".`;

      let resultText = "";

      if (preferredModel === 'openai' && openaiKey) {
        const openai = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
        const messages: any[] = [{ role: "system", content: "You are an expert e-commerce SEO specialist." }];
        
        let userContent: any[] = [{ type: "text", text: prompt }];
        if (productDetails) userContent.push({ type: "text", text: `Product Details: ${productDetails}` });
        if (image) userContent.push({ type: "image_url", image_url: { url: image } });

        messages.push({ role: "user", content: userContent });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages,
          response_format: { type: "json_object" }
        });
        resultText = completion.choices[0].message.content || "{}";
      } else {
        const aiInstance = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : defaultAi;
        const contents: any[] = [{ text: prompt }];
        if (productDetails) contents.push({ text: `Product Details: ${productDetails}` });
        if (image) {
          const base64Data = image.split(',')[1];
          contents.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
        }

        const response: GenerateContentResponse = await aiInstance.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: { parts: contents },
          config: { 
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          }
        });
        resultText = response.text || "{}";
      }

      const result = JSON.parse(resultText);
      const newListing = { ...result, productDetails, category, platform };
      setListing(newListing);
    } catch (error: any) {
      console.error("Generation failed:", error);
      if (error.message?.includes('API key not valid') || error.message?.includes('quota')) {
        alert("API limit reached or invalid key. Please update your API key in Settings.");
        setShowSettings(true);
      } else {
        alert("Failed to generate listing. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 vibrant-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShoppingBag size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight vibrant-text hidden sm:block">
              E-com SEO Pro
            </h1>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
            <button
              onClick={() => setPlatform('meesho')}
              className={cn(
                "px-4 sm:px-6 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200",
                platform === 'meesho' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Meesho
            </button>
            <button
              onClick={() => setPlatform('flipkart')}
              className={cn(
                "px-4 sm:px-6 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200",
                platform === 'flipkart' 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Flipkart
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors relative group"
              title="Settings"
            >
              <SettingsIcon size={20} className="text-indigo-600" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-[32px] p-8 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Zap size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Create Listing</h2>
                </div>
              </div>

              {/* Category Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Product Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-semibold appearance-none cursor-pointer"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Product Image</label>
                {!image ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-[24px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
                  >
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all group-hover:scale-110">
                      <Upload size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700">Click to upload image</p>
                      <p className="text-xs text-slate-400 mt-1">AI will analyze visual features</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                ) : (
                  <div className="relative rounded-[24px] overflow-hidden aspect-video bg-slate-100 group shadow-inner">
                    <img src={image} alt="Preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={removeImage}
                        className="p-3 bg-white rounded-full text-red-500 shadow-xl hover:scale-110 transition-transform"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Input */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Product Details</label>
                <textarea
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                  placeholder="Enter product name, material, size, or any specific details..."
                  className="w-full h-40 p-5 rounded-[24px] bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none text-sm placeholder:text-slate-400 leading-relaxed font-medium"
                />
              </div>

              <button
                onClick={generateListing}
                disabled={isGenerating || (!productDetails && !image)}
                className="w-full py-5 vibrant-gradient hover:opacity-90 disabled:bg-slate-300 text-white rounded-[24px] font-bold shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98] group"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    Generating SEO Magic...
                  </>
                ) : (
                  <>
                    <Sparkles size={22} className="group-hover:rotate-12 transition-transform" />
                    Generate {platform === 'meesho' ? 'Meesho' : 'Flipkart'} Listing
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output Section */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!listing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full min-h-[500px] glass-card rounded-[32px] flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center text-slate-300 mb-8">
                    <LayoutGrid size={48} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">Ready to Generate</h3>
                  <p className="text-slate-500 max-w-sm mt-3 leading-relaxed">
                    Our AI expert will craft the perfect SEO-optimized listing for your product. Just fill in the details!
                  </p>
                  <div className="mt-12 flex flex-wrap justify-center items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      SEO READY
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      TOP RANKING
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      ONE-CLICK COPY
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                        <Check size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">Listing Generated</h3>
                        <p className="text-xs text-slate-500">Optimized for {platform} • {category}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setListing(null)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                    >
                      <Plus size={16} />
                      New Listing
                    </button>
                  </div>

                  {/* Title Card */}
                  <OutputCard 
                    label="Product Title" 
                    content={listing.title} 
                    onCopy={() => copyToClipboard(listing.title, 'title')}
                    isCopied={copiedField === 'title'}
                  />

                  {/* Description Card */}
                  <OutputCard 
                    label="Description" 
                    content={listing.description} 
                    onCopy={() => copyToClipboard(listing.description, 'description')}
                    isCopied={copiedField === 'description'}
                    isLarge
                  />

                  {/* Platform Specific Cards */}
                  {platform === 'flipkart' && (
                    <>
                      <OutputCard 
                        label="Keywords" 
                        content={listing.keywords || ''} 
                        onCopy={() => copyToClipboard(listing.keywords || '', 'keywords')}
                        isCopied={copiedField === 'keywords'}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <OutputCard 
                          label="Key Features" 
                          content={listing.keyFeatures || ''} 
                          onCopy={() => copyToClipboard(listing.keyFeatures || '', 'keyFeatures')}
                          isCopied={copiedField === 'keyFeatures'}
                          isLarge
                        />
                        <OutputCard 
                          label="Additional Features" 
                          content={listing.additionalFeatures || ''} 
                          onCopy={() => copyToClipboard(listing.additionalFeatures || '', 'additionalFeatures')}
                          isCopied={copiedField === 'additionalFeatures'}
                          isLarge
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-slate-400 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
              <ShoppingBag size={18} />
            </div>
            <p className="font-bold text-slate-500">E-com SEO Pro</p>
          </div>
          <p>© 2026 E-com SEO Pro. Expert Tools for Sellers.</p>
          <div className="flex items-center gap-8 font-semibold">
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface OutputCardProps {
  label: string;
  content: any;
  onCopy: () => void;
  isCopied: boolean;
  isLarge?: boolean;
}

function OutputCard({ label, content, onCopy, isCopied, isLarge }: OutputCardProps) {
  const renderContent = () => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return Object.entries(content)
        .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}: ${value}`)
        .join('\n');
    }
    return String(content || '');
  };

  const displayContent = renderContent();

  return (
    <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-200 transition-colors">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        <button
          onClick={onCopy}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95",
            isCopied 
              ? "bg-green-500 text-white shadow-lg shadow-green-100" 
              : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm"
          )}
        >
          {isCopied ? (
            <>
              <Check size={14} />
              Copied
            </>
          ) : (
            <>
              <Copy size={14} />
              Copy
            </>
          )}
        </button>
      </div>
      <div className={cn(
        "p-6 text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-medium",
        isLarge ? "max-h-[400px] overflow-y-auto custom-scrollbar" : ""
      )}>
        {displayContent}
      </div>
    </div>
  );
}
