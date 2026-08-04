import React, { useState, useRef } from 'react';
import { Calendar, Download, Image as ImageIcon, Briefcase, Share2, Upload, Sparkles, PlayCircle, Copy, Target, MessageCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface ContentEntry {
  id: string;
  date: string;
  platform: string;
  type: string;
  topic?: string;
  content: string;
  objective?: string;
  visualIdea?: string;
}

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'YouTube', 'TikTok', 'Pinterest'];

const getAverageColor = (imgElement: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  canvas.width = imgElement.width || imgElement.naturalWidth || 100;
  canvas.height = imgElement.height || imgElement.naturalHeight || 100;
  context.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 40) {
    if (data[i+3] < 128) continue; // skip transparent
    if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) continue; // skip white backgrounds
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  if (count === 0) return '#2563eb';
  r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export default function ContentCalendar() {
  const [clientName, setClientName] = useState('');
  const [monthYear, setMonthYear] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#2563eb');
  
  // New AI Form State
  const [promotionDetails, setPromotionDetails] = useState('');
  const [numPosts, setNumPosts] = useState(5);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram', 'LinkedIn']);
  
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getIconForType = (type: string, color: string) => {
    const t = type.toLowerCase();
    const style = { color: 'white', fill: color };
    if (t.includes('video') || t.includes('reel') || t.includes('short')) return <PlayCircle className="w-10 h-10" style={style} />;
    if (t.includes('carousel')) return <Copy className="w-10 h-10" style={style} />;
    return <ImageIcon className="w-10 h-10" style={style} />;
  };

  const handlePlatformToggle = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleGenerateFullCalendar = async () => {
    if (!clientName || !promotionDetails || selectedPlatforms.length === 0) {
      alert("Please fill in the Client Name, Promotion Details, and select at least one platform.");
      return;
    }
    
    setIsGeneratingAi(true);
    try {
      const { generateContentCalendar } = await import('../services/api');
      const data = await generateContentCalendar({
        clientName,
        promotionDetails,
        numPosts,
        platforms: selectedPlatforms
      });
      
      // Map data to state
      const generatedEntries = data.map((item: any, i: number) => ({
        id: Date.now().toString() + i,
        date: item.date,
        platform: item.platform,
        type: item.type,
        topic: item.topic,
        content: item.content,
        objective: item.objective,
        visualIdea: item.visualIdea
      }));
      setEntries(generatedEntries);
    } catch (err) {
      console.error("Failed to generate calendar", err);
      alert("Failed to generate calendar. Make sure the backend is running and Gemini API key is configured.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);

      const img = new Image();
      img.src = url;
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const color = getAverageColor(img);
        if (color) setThemeColor(color);
      };
    }
  };

  const downloadImage = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, quality: 1, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${clientName || 'Client'}_Content_Calendar.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, quality: 1, pixelRatio: 2 });
      
      // Calculate aspect ratio for PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [previewRef.current.offsetWidth, previewRef.current.offsetHeight]
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, previewRef.current.offsetWidth, previewRef.current.offsetHeight);
      pdf.save(`${clientName || 'Client'}_Content_Calendar.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Content Calendar Generator</h1>
          <p className="text-gray-500">Create beautiful, branded content calendars for your clients instantly.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={downloadImage}
            disabled={isGenerating}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Save as PNG
          </button>
          <button 
            onClick={downloadPDF}
            disabled={isGenerating}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="space-y-12">
        
        {/* FORM SECTION */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center border-b pb-4">
            <Sparkles className="w-6 h-6 mr-2 text-indigo-500" />
            AI Calendar Generator
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-indigo-500" />
              Client Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input 
                  type="text" 
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month / Campaign Name</label>
                <input 
                  type="text" 
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  placeholder="e.g. October 2026"
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Logo</label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-16 mx-auto object-contain" />
                  ) : (
                    <div className="text-gray-500 flex flex-col items-center">
                      <Upload className="w-6 h-6 mb-2 text-gray-400" />
                      <span className="text-sm">Click to upload logo</span>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                </div>
                {logoUrl && (
                  <p className="text-xs text-green-600 mt-2 flex items-center justify-center">
                    Brand color extracted! ({themeColor})
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Theme Color</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="color" 
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-8 w-12 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">Pick manually if needed</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What are we promoting?</label>
                <textarea 
                  value={promotionDetails}
                  onChange={(e) => setPromotionDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-md resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. A new summer clothing collection for young adults. We want to highlight discounts and fresh styles."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Posts</label>
                  <input 
                    type="number"
                    min="1"
                    max="30"
                    value={numPosts}
                    onChange={(e) => setNumPosts(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <label key={p} className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full border cursor-pointer hover:bg-gray-100">
                      <input 
                        type="checkbox"
                        checked={selectedPlatforms.includes(p)}
                        onChange={() => handlePlatformToggle(p)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-medium text-gray-700">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleGenerateFullCalendar}
              disabled={isGeneratingAi}
              className="mt-6 w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {isGeneratingAi ? 'Generating Calendar...' : 'Generate Full Calendar'}
            </button>
          </div>
        </div>

        {/* PREVIEW SECTION */}
        <div className="w-full">
          <div className="bg-gray-50 p-4 md:p-8 rounded-xl border border-gray-200">
            <p className="text-center text-gray-500 mb-6 text-sm font-medium">Live Preview (What you see is what gets exported)</p>
            
            {/* The actual element that gets exported */}
            <div 
              ref={previewRef}
              className="bg-white shadow-lg mx-auto overflow-hidden rounded-xl"
              style={{ width: '100%', minWidth: '800px', maxWidth: '1000px', minHeight: '600px' }}
            >
              {/* Header */}
              <div 
                className="p-8 flex justify-between items-center text-white"
                style={{ backgroundColor: themeColor }}
              >
                <div>
                  <h2 className="text-3xl font-bold mb-1 opacity-90">{clientName || 'Client Name'}</h2>
                  <p className="text-lg opacity-80 uppercase tracking-widest">{monthYear || 'Month Year'}</p>
                </div>
                {logoUrl && (
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <img src={logoUrl} alt="Client Logo" className="h-16 w-auto object-contain" />
                  </div>
                )}
              </div>

              {/* Table / Grid content */}
              <div className="p-8">
                <div className="mb-6 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" style={{ color: themeColor }} />
                  <h3 className="text-xl font-semibold text-gray-800">Content Schedule</h3>
                </div>

                <div className="w-full border-2" style={{ borderColor: themeColor }}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-white text-sm tracking-widest font-bold uppercase" style={{ backgroundColor: themeColor }}>
                        <th className="py-4 px-4 text-center border-r border-white/20 w-32">Date</th>
                        <th className="py-4 px-4 text-center border-r border-white/20 w-32">Day</th>
                        <th className="py-4 px-6 border-r border-white/20">Content</th>
                        <th className="py-4 px-6 border-r border-white/20 w-48">Objective</th>
                        <th className="py-4 px-6 w-48">CTA / Visual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, idx) => {
                        const isEven = idx % 2 === 0;
                        const dateObj = entry.date ? new Date(entry.date) : null;
                        const dayString = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase() : 'TBD';
                        const dateString = dateObj ? dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase() : 'TBD';
                        
                        return (
                          <tr 
                            key={entry.id} 
                            className="border-b"
                            style={{ backgroundColor: isEven ? '#ffffff' : '#f9fafb', borderColor: `${themeColor}40` }}
                          >
                            <td className="py-6 px-4 align-middle text-center font-bold text-xl text-gray-800 border-r border-gray-200">
                              {dateString}
                            </td>
                            <td className="py-6 px-4 align-middle text-center font-bold text-lg text-gray-800 border-r border-gray-200">
                              {dayString}
                            </td>
                            <td className="py-6 px-6 align-top border-r border-gray-200">
                              <div className="flex items-start">
                                <div className="mr-4 mt-1 shrink-0">
                                  {getIconForType(entry.type, themeColor)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-lg text-gray-900 leading-tight mb-2">
                                    {entry.topic || entry.content.substring(0, 30) + '...'}
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-snug">
                                    {entry.content}
                                  </p>
                                  <div className="mt-3">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                                      <Share2 className="w-3 h-3 mr-1" />
                                      {entry.platform} - {entry.type}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 px-6 align-top border-r border-gray-200">
                              <div className="flex items-start">
                                <Target className="w-6 h-6 mr-3 shrink-0" style={{ color: themeColor }} />
                                <span className="font-semibold text-gray-800 text-sm leading-snug mt-0.5">
                                  {entry.objective || 'Brand Awareness'}
                                </span>
                              </div>
                            </td>
                            <td className="py-6 px-6 align-top">
                              <div className="flex items-start">
                                <MessageCircle className="w-6 h-6 mr-3 shrink-0" style={{ color: themeColor }} />
                                <span className="font-semibold text-gray-800 text-sm leading-snug mt-0.5">
                                  {entry.visualIdea || 'Link in Bio'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-16 text-center bg-white">
                            <Sparkles className="w-10 h-10 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium text-lg">No content generated yet.</p>
                            <p className="text-gray-400 mt-2">Fill out the prompt builder above to get started!</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  
                  {/* Action Plan Footer */}
                  {entries.length > 0 && (
                    <div className="bg-gray-800 text-white p-6 grid grid-cols-2 gap-8">
                      <div>
                        <h4 className="font-bold text-lg mb-3 tracking-widest uppercase border-b border-gray-600 pb-2">Action Plan</h4>
                        <ul className="space-y-2 text-sm text-gray-300">
                          <li className="flex items-center"><div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: themeColor}}></div> Repurpose Reels to YouTube Shorts</li>
                          <li className="flex items-center"><div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: themeColor}}></div> Reply to DMs & Comments Daily</li>
                          <li className="flex items-center"><div className="w-2 h-2 rounded-full mr-2" style={{backgroundColor: themeColor}}></div> Run Platform-Specific Ads</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-lg mb-3 tracking-widest uppercase border-b border-gray-600 pb-2">Goal</h4>
                        <div className="flex items-center">
                          <Target className="w-12 h-12 mr-4" style={{ color: themeColor }} />
                          <p className="text-sm font-medium text-gray-300 leading-relaxed">
                            Generate quality leads, increase engagement across all platforms, and achieve the primary objectives outlined in this calendar for {clientName || 'the client'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
