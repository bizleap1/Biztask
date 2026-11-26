import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Download,
  Image as ImageIcon,
  Sparkles,
  Plus,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Filter,
  Trash2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import api from '../services/api';
import {
  contentCalendarService
} from '../services/contentCalendarService';
import type {
  ContentCalendar as IContentCalendar,
  ContentItem as IContentItem
} from '../services/contentCalendarService';

interface ClientOption {
  id: number;
  name: string;
  companyName?: string;
}

interface DepartmentOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  name: string;
}

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter', 'YouTube', 'TikTok', 'Pinterest'];
const POST_TYPES = ['Reel', 'Carousel', 'Static Post', 'Story', 'Video', 'Blog'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
    if (data[i + 3] < 128) continue;
    if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
  }
  if (count === 0) return '#2563eb';
  r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export default function ContentCalendar() {
  const [calendars, setCalendars] = useState<IContentCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<IContentCalendar | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & tab states
  const [viewMode, setViewMode] = useState<'grid' | 'preview'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // New Calendar Modal
  const [showNewCalendarModal, setShowNewCalendarModal] = useState(false);
  const [newCalTitle, setNewCalTitle] = useState('');
  const [newCalClient, setNewCalClient] = useState<number | ''>('');
  const [newCalMonth, setNewCalMonth] = useState(new Date().getMonth() + 1);
  const [newCalYear, setNewCalYear] = useState(new Date().getFullYear());
  const [newCalNotes, setNewCalNotes] = useState('');

  // AI Generation State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPromotion, setAiPromotion] = useState('');
  const [aiNumPosts, setAiNumPosts] = useState(5);
  const [aiPlatforms, setAiPlatforms] = useState<string[]>(['Instagram', 'LinkedIn']);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Convert to Task Modal
  const [convertingItem, setConvertingItem] = useState<IContentItem | null>(null);
  const [convertDept, setConvertDept] = useState<number | ''>('');
  const [convertAssignee, setConvertAssignee] = useState<number | ''>('');
  const [convertPriority, setConvertPriority] = useState('Medium');
  const [isConverting, setIsConverting] = useState(false);

  // Manual Add Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemDate, setItemDate] = useState('');
  const [itemPlatform, setItemPlatform] = useState('Instagram');
  const [itemType, setItemType] = useState('Reel');
  const [itemTopic, setItemTopic] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [itemObjective, setItemObjective] = useState('');
  const [itemVisual, setItemVisual] = useState('');
  const [itemHashtags, setItemHashtags] = useState('');

  // Visual Export State
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [cals, clisRes, deptsRes, usersRes] = await Promise.all([
        contentCalendarService.getCalendars(),
        api.get('/clients').catch(() => ({ data: { clients: [] } })),
        api.get('/users/departments').catch(() => ({ data: { departments: [] } })),
        api.get('/users').catch(() => ({ data: { users: [] } }))
      ]);
      setCalendars(cals);
      setClients(clisRes.data?.clients || []);
      setDepartments(deptsRes.data?.departments || []);
      setUsers(usersRes.data?.users || []);

      if (cals.length > 0) {
        const fullCal = await contentCalendarService.getCalendarById(cals[0].id);
        setSelectedCalendar(fullCal);
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load a calendar by ID
  const selectCalendar = async (id: number) => {
    try {
      const cal = await contentCalendarService.getCalendarById(id);
      setSelectedCalendar(cal);
    } catch (err) {
      console.error('Error fetching calendar', err);
    }
  };

  // Create new calendar
  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalTitle || !newCalClient) return;
    try {
      const created = await contentCalendarService.createCalendar({
        title: newCalTitle,
        clientId: Number(newCalClient),
        month: Number(newCalMonth),
        year: Number(newCalYear),
        notes: newCalNotes
      });
      setShowNewCalendarModal(false);
      setNewCalTitle('');
      setNewCalNotes('');
      await loadInitialData();
      await selectCalendar(created.id);
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error creating calendar';
      alert(errorMsg);
    }
  };

  // Run AI Generator
  const handleGenerateAi = async () => {
    if (!selectedCalendar) return;
    setIsGeneratingAi(true);
    try {
      await contentCalendarService.generateAiItems(selectedCalendar.id, {
        numPosts: aiNumPosts,
        platforms: aiPlatforms,
        promotionDetails: aiPromotion
      });
      setShowAiModal(false);
      setAiPromotion('');
      await selectCalendar(selectedCalendar.id);
      alert('AI content items generated successfully! Review them in the Draft status.');
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to generate AI items';
      alert(errorMsg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Add Manual Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalendar || !itemDate || !itemTopic || !itemContent) return;
    try {
      await contentCalendarService.addItem(selectedCalendar.id, {
        scheduledDate: itemDate,
        platform: itemPlatform,
        postType: itemType,
        topic: itemTopic,
        content: itemContent,
        objective: itemObjective,
        visualIdea: itemVisual,
        hashtags: itemHashtags
      });
      setShowAddItemModal(false);
      setItemDate('');
      setItemTopic('');
      setItemContent('');
      setItemObjective('');
      setItemVisual('');
      setItemHashtags('');
      await selectCalendar(selectedCalendar.id);
    } catch (err) {
      console.error(err);
      alert('Failed to add item');
    }
  };

  // Approve Item
  const handleApproveItem = async (itemId: number) => {
    if (!selectedCalendar) return;
    try {
      await contentCalendarService.approveItem(selectedCalendar.id, itemId);
      await selectCalendar(selectedCalendar.id);
    } catch (err) {
      console.error(err);
      alert('Failed to approve item');
    }
  };

  // Reject Item
  const handleRejectItem = async (itemId: number) => {
    if (!selectedCalendar) return;
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await contentCalendarService.rejectItem(selectedCalendar.id, itemId, reason);
      await selectCalendar(selectedCalendar.id);
    } catch (err) {
      console.error(err);
      alert('Failed to reject item');
    }
  };

  // Delete Item
  const handleDeleteItem = async (itemId: number) => {
    if (!selectedCalendar || !confirm('Are you sure you want to delete this content item?')) return;
    try {
      await contentCalendarService.deleteItem(selectedCalendar.id, itemId);
      await selectCalendar(selectedCalendar.id);
    } catch (err) {
      console.error(err);
      alert('Failed to delete item');
    }
  };

  // Convert to Task
  const handleConvertToTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalendar || !convertingItem || !convertDept) return;
    setIsConverting(true);
    try {
      await contentCalendarService.convertToTask(selectedCalendar.id, convertingItem.id, {
        departmentId: Number(convertDept),
        assignedToId: convertAssignee ? Number(convertAssignee) : undefined,
        priority: convertPriority
      });
      setConvertingItem(null);
      await selectCalendar(selectedCalendar.id);
      alert('Successfully converted to task!');
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to convert to task';
      alert(errorMsg);
    } finally {
      setIsConverting(false);
    }
  };

  // Export handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      const img = new Image();
      img.src = url;
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const color = getAverageColor(img);
        if (color) setThemeColor(color);
      };
    }
  };

  const downloadImage = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, quality: 1, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${selectedCalendar?.title || 'Content_Calendar'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPDF = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, quality: 1, pixelRatio: 2 });
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [previewRef.current.offsetWidth, previewRef.current.offsetHeight]
      });
      pdf.addImage(dataUrl, 'PNG', 0, 0, previewRef.current.offsetWidth, previewRef.current.offsetHeight);
      pdf.save(`${selectedCalendar?.title || 'Content_Calendar'}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredItems = (selectedCalendar?.items || []).filter(item => {
    if (statusFilter === 'All') return true;
    return item.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarIcon className="w-7 h-7 text-indigo-600" />
            Content Calendar AI
          </h1>
          <p className="text-gray-500 text-sm">
            Monthly client content planning, AI post generation, review gate, and task execution.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewCalendarModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Calendar
          </button>
          {selectedCalendar && (
            <>
              <button
                onClick={() => setShowAiModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Generate with AI
              </button>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Post
              </button>
            </>
          )}
        </div>
      </div>

      {/* Calendar Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
          <span className="text-xs font-semibold uppercase text-gray-400">Calendar:</span>
          {calendars.length === 0 ? (
            <span className="text-sm text-gray-500">No calendars created yet.</span>
          ) : (
            calendars.map(cal => (
              <button
                key={cal.id}
                onClick={() => selectCalendar(cal.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                  selectedCalendar?.id === cal.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cal.title} ({cal.client?.name || 'Client'})
              </button>
            ))
          )}
        </div>

        {selectedCalendar && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-medium">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-xs text-gray-900 font-semibold' : 'text-gray-500'}`}
              >
                Workflow Grid
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${viewMode === 'preview' ? 'bg-white shadow-xs text-gray-900 font-semibold' : 'text-gray-500'}`}
              >
                Branded Presentation
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading calendars...</div>
      ) : !selectedCalendar ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No Content Calendar Selected</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-4">
            Create a monthly content calendar for your client or choose an existing one from above.
          </p>
          <button
            onClick={() => setShowNewCalendarModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Create Your First Calendar
          </button>
        </div>
      ) : (
        <>
          {/* Calendar Header Card */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">{selectedCalendar.title}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {MONTH_NAMES[selectedCalendar.month - 1]} {selectedCalendar.year}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  Client: {selectedCalendar.client?.name}
                </span>
              </div>
              {selectedCalendar.notes && (
                <p className="text-xs text-gray-500 mt-1">{selectedCalendar.notes}</p>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
              {['All', 'Draft', 'Approved', 'Rejected', 'ConvertedToTask'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition ${
                    statusFilter === st
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st === 'ConvertedToTask' ? 'Converted' : st}
                </button>
              ))}
            </div>
          </div>

          {/* VIEW MODE 1: WORKFLOW GRID */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-gray-200 text-gray-400">
                  No content items found for status "{statusFilter}". Click "Generate with AI" or "Add Post" to start.
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-xs hover:shadow-md transition p-5 flex flex-col justify-between"
                  >
                    <div>
                      {/* Item Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700">
                            {item.platform}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                            {item.postType}
                          </span>
                        </div>
                        {item.aiGenerated && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-medium">
                            <Sparkles className="w-3 h-3" /> AI
                          </span>
                        )}
                      </div>

                      {/* Date & Topic */}
                      <div className="text-xs font-semibold text-gray-400 mb-1">
                        {new Date(item.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2 leading-snug">
                        {item.topic}
                      </h4>
                      <p className="text-xs text-gray-600 mb-3 whitespace-pre-wrap line-clamp-3">
                        {item.content}
                      </p>

                      {/* Visual & Objective notes */}
                      {item.visualIdea && (
                        <div className="bg-amber-50/60 border border-amber-100 p-2 rounded text-[11px] text-amber-900 mb-2">
                          <strong className="font-semibold">Visual: </strong>{item.visualIdea}
                        </div>
                      )}

                      {item.hashtags && (
                        <div className="text-[11px] text-blue-600 mb-3 truncate font-mono">
                          {item.hashtags}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions / Review Gate */}
                    <div className="pt-3 border-t border-gray-100 mt-2">
                      <div className="flex items-center justify-between">
                        {/* Status badge */}
                        <div>
                          {item.status === 'Draft' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Draft Review
                            </span>
                          )}
                          {item.status === 'Approved' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                              Approved
                            </span>
                          )}
                          {item.status === 'Rejected' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              Rejected
                            </span>
                          )}
                          {item.status === 'ConvertedToTask' && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              Task #{item.taskId}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                          {item.status === 'Draft' && (
                            <>
                              <button
                                onClick={() => handleApproveItem(item.id)}
                                title="Approve Item"
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectItem(item.id)}
                                title="Reject Item"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {item.status === 'Approved' && !item.taskId && (
                            <button
                              onClick={() => {
                                setConvertingItem(item);
                                if (departments.length > 0) setConvertDept(departments[0].id);
                              }}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer"
                            >
                              Convert to Task <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.reviewNotes && (
                        <div className="mt-2 text-[11px] text-gray-500 italic bg-gray-50 p-1.5 rounded">
                          Review note: {item.reviewNotes}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW MODE 2: BRANDED PRESENTATION (PDF/PNG EXPORT) */}
          {viewMode === 'preview' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Upload Brand Logo</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="text-xs text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Theme Color</label>
                    <input
                      type="color"
                      value={themeColor}
                      onChange={e => setThemeColor(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadImage}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-medium cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <ImageIcon className="w-4 h-4" /> Export PNG
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs font-medium cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" /> Export PDF
                  </button>
                </div>
              </div>

              {/* Printable Canvas */}
              <div
                ref={previewRef}
                style={{ backgroundColor: '#ffffff', minHeight: '600px' }}
                className="p-8 rounded-2xl border border-gray-200 shadow-md"
              >
                {/* Header Banner */}
                <div
                  style={{ borderBottom: `4px solid ${themeColor}` }}
                  className="pb-6 mb-8 flex justify-between items-end"
                >
                  <div>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-12 object-contain mb-2" />
                    ) : (
                      <h3 style={{ color: themeColor }} className="text-2xl font-black uppercase tracking-wider mb-1">
                        {selectedCalendar.client?.name || 'Client Brand'}
                      </h3>
                    )}
                    <h2 className="text-3xl font-extrabold text-gray-900">
                      {selectedCalendar.title}
                    </h2>
                    <p className="text-sm font-semibold text-gray-500">
                      {MONTH_NAMES[selectedCalendar.month - 1]} {selectedCalendar.year} • Content & Social Media Strategy
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
                      className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                    >
                      {selectedCalendar.items?.length || 0} Scheduled Posts
                    </span>
                  </div>
                </div>

                {/* Printable Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(selectedCalendar.items || []).map(item => (
                    <div
                      key={item.id}
                      style={{ borderTop: `3px solid ${themeColor}` }}
                      className="bg-gray-50/70 p-5 rounded-xl border border-gray-100 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span
                            style={{ backgroundColor: themeColor }}
                            className="text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                          >
                            {item.platform}
                          </span>
                          <span className="text-xs font-bold text-gray-500">
                            {new Date(item.scheduledDate).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric'
                            })}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">{item.topic}</h4>
                        <p className="text-xs text-gray-600 line-clamp-3 mb-3">{item.content}</p>
                        {item.visualIdea && (
                          <div className="text-[11px] text-gray-500 bg-white p-2 rounded border border-gray-100 mb-2">
                            <strong>Visual: </strong>{item.visualIdea}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-2 border-t border-gray-200 flex justify-between">
                        <span>Format: {item.postType}</span>
                        <span>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: NEW CALENDAR */}
      {showNewCalendarModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create Content Calendar</h3>
            <form onSubmit={handleCreateCalendar} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Calendar Title</label>
                <input
                  type="text"
                  required
                  value={newCalTitle}
                  onChange={e => setNewCalTitle(e.target.value)}
                  placeholder="e.g. Q1 Instagram Growth & Reels"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                <select
                  required
                  value={newCalClient}
                  onChange={e => setNewCalClient(Number(e.target.value))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a Client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.companyName ? `(${c.companyName})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
                  <select
                    value={newCalMonth}
                    onChange={e => setNewCalMonth(Number(e.target.value))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={newCalYear}
                    onChange={e => setNewCalYear(Number(e.target.value))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Strategy / Objective Notes</label>
                <textarea
                  value={newCalNotes}
                  onChange={e => setNewCalNotes(e.target.value)}
                  placeholder="Monthly goals, campaign themes, visual tone..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm h-20 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCalendarModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
                >
                  Create Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AI GENERATOR */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 text-purple-700 font-bold text-lg mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Generate Content with AI
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Our AI will design scheduled posts for {selectedCalendar?.client?.name} for {MONTH_NAMES[(selectedCalendar?.month || 1) - 1]} {selectedCalendar?.year}.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        if (aiPlatforms.includes(p)) {
                          setAiPlatforms(aiPlatforms.filter(item => item !== p));
                        } else {
                          setAiPlatforms([...aiPlatforms, p]);
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                        aiPlatforms.includes(p)
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Number of Posts</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiNumPosts}
                  onChange={e => setAiNumPosts(Number(e.target.value))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Campaign Focus / Promotion Details</label>
                <textarea
                  value={aiPromotion}
                  onChange={e => setAiPromotion(e.target.value)}
                  placeholder="e.g. Launching a new 20% discount on web development, customer testimonials, tech tips..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm h-24 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isGeneratingAi || aiPlatforms.length === 0}
                  onClick={handleGenerateAi}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingAi ? 'Generating...' : 'Generate Posts'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ADD POST */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Content Item</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={itemDate}
                    onChange={e => setItemDate(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Platform</label>
                  <select
                    value={itemPlatform}
                    onChange={e => setItemPlatform(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
                  <select
                    value={itemType}
                    onChange={e => setItemType(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  >
                    {POST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post Headline / Topic</label>
                <input
                  type="text"
                  required
                  value={itemTopic}
                  onChange={e => setItemTopic(e.target.value)}
                  placeholder="e.g. 5 Common SEO Mistakes in 2026"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Post Caption & Content</label>
                <textarea
                  required
                  value={itemContent}
                  onChange={e => setItemContent(e.target.value)}
                  placeholder="Full caption, copy, hook, and call to action..."
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs h-20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Visual Direction / Creative Idea</label>
                <input
                  type="text"
                  value={itemVisual}
                  onChange={e => setItemVisual(e.target.value)}
                  placeholder="e.g. Carousel with bold gradient slides or behind-the-scenes video"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hashtags</label>
                <input
                  type="text"
                  value={itemHashtags}
                  onChange={e => setItemHashtags(e.target.value)}
                  placeholder="#business #growth #marketing"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
                >
                  Save Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVERT TO TASK */}
      {convertingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Convert Content to Task</h3>
            <p className="text-xs text-gray-500 mb-4">
              Creating task for "{convertingItem.topic}" scheduled for {new Date(convertingItem.scheduledDate).toLocaleDateString()}.
            </p>
            <form onSubmit={handleConvertToTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select
                  required
                  value={convertDept}
                  onChange={e => setConvertDept(Number(e.target.value))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select Department...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign To (Optional)</label>
                <select
                  value={convertAssignee}
                  onChange={e => setConvertAssignee(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={convertPriority}
                  onChange={e => setConvertPriority(e.target.value)}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isConverting}
                  onClick={() => setConvertingItem(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConverting || !convertDept}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isConverting ? 'Creating Task...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
