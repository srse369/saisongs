import React, { useState, useEffect } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { useSongs } from '../../contexts/SongContext';
import { CsvParserService, type CsvPitchData } from '../../services/CsvParserService';
import { CsvImportService, type ImportPreviewItem, type ImportResult } from '../../services/CsvImportService';
import { normalizePitch, addPitchMapping, removePitchMapping } from '../../utils/pitchNormalization';
import { findTopSongMatches, normalizeSongNameForMapping } from '../../utils/songMatcher';
import { saveSongMapping, savePitchMapping, getStoredPitchMappings, getStoredSongMappings, deleteSongMapping, deletePitchMapping } from '../../services/ImportMappingService';
import { LoadingSpinner } from '../common/LoadingSpinner';

type ImportStep = 'instructions' | 'scraping' | 'preview' | 'importing' | 'complete';

export const CsvImportManager: React.FC = () => {
  const { singers, loading: singersLoading } = useSingers();
  const { songs, loading: songsLoading } = useSongs();
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('instructions');
  const [scrapedData, setScrapedData] = useState<CsvPitchData[]>([]);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  
  // Manual input states
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [manualSongInput, setManualSongInput] = useState<string>('');
  const [manualPitchInput, setManualPitchInput] = useState<string>('');
  
  // Store song mappings in memory (normalized csvName -> { dbSongId, dbSongName })
  const [songMappings, setSongMappings] = useState<Map<string, { dbSongId: string; dbSongName: string }>>(new Map());
  
  // Helper function to clean pitch format (matches normalizePitch() cleaning logic)
  const cleanPitchFormat = (pitch: string): string => {
    return pitch
      .trim()
      .replace(/\s+/g, '')
      .replace(/\u00A0/g, '')
      .replace(/\u200B/g, '');
  };
  
  // Get all available pitches from database
  const availablePitches = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
    'C major', 'C# major', 'D major', 'D# major', 'E major', 'F major', 
    'F# major', 'G major', 'G# major', 'A major', 'A# major', 'B major',
    'C minor', 'C# minor', 'D minor', 'D# minor', 'E minor', 'F minor',
    'F# minor', 'G minor', 'G# minor', 'A minor', 'A# minor', 'B minor',
    '1 Madhyam', '1.5 Madhyam', '2 Madhyam', '2.5 Madhyam', '3 Madhyam',
    '4 Madhyam', '4.5 Madhyam', '5 Madhyam', '5.5 Madhyam', '6 Madhyam',
    '6.5 Madhyam', '7 Madhyam'
  ];
  
  // Load stored mappings on mount
  useEffect(() => {
    const loadMappings = async () => {
      // Load pitch mappings
      const storedPitchMappings = await getStoredPitchMappings();
      storedPitchMappings.forEach(mapping => {
        // Clean the original format to match how normalizePitch() cleans input
        const cleanedFormat = cleanPitchFormat(mapping.originalFormat);
        addPitchMapping(cleanedFormat, mapping.normalizedFormat);
      });
      
      // Load song mappings into memory
      const storedSongMappings = await getStoredSongMappings();
      const songMappingsMap = new Map<string, { dbSongId: string; dbSongName: string }>();
      storedSongMappings.forEach(mapping => {
        const normalizedKey = normalizeSongNameForMapping(mapping.csvSongName);
        songMappingsMap.set(normalizedKey, {
          dbSongId: mapping.dbSongId,
          dbSongName: mapping.dbSongName
        });
      });
      setSongMappings(songMappingsMap);
    };
    loadMappings();
  }, []);
  
  useEffect(() => {
    if (scrapedData.length > 0 && !singersLoading && !songsLoading) {
      generatePreview();
    }
  }, [scrapedData, singersLoading, songsLoading]);
  
  // Sort preview items with unmatched rows at top
  const sortPreview = (items: ImportPreviewItem[]): ImportPreviewItem[] => {
    return [...items].sort((a, b) => {
      const statusPriority: Record<string, number> = {
        'needs_song': 1,
        'needs_pitch': 2,
        'ready': 3,
        'pending': 4,
        'error': 5,
        'dropped': 99,
      };
      
      const aPriority = statusPriority[a.status] || 50;
      const bPriority = statusPriority[b.status] || 50;
      
      return aPriority - bPriority;
    });
  };
  
  const generatePreview = async () => {
    const preview = await CsvImportService.createImportPreview(
      scrapedData,
      singers,
      songs,
      songMappings
    );
    setPreviewItems(preview);
    setCurrentStep('preview');
  };
  
  const handleManualSongName = async (index: number, songId: string) => {
    try {
      const newPreview = [...previewItems];
      const item = newPreview[index];
      
      // Find song by ID
      const song = songs.find(s => s.id === songId);
      
      if (song) {
        const originalSongName = item.originalSongName;
        let exactMatchCount = 0;
        const similarUnmatched: Array<{ index: number; name: string; similarity: number }> = [];
        
        // Save mapping for future imports (normalized internally to handle variations)
        // This will match future imports even if they have different case, spacing, or punctuation
        await saveSongMapping(originalSongName, song.id, song.name);
        
        // Also update in-memory map for immediate use
        const normalizedKey = normalizeSongNameForMapping(originalSongName);
        setSongMappings(prev => {
          const updated = new Map(prev);
          updated.set(normalizedKey, { dbSongId: song.id, dbSongName: song.name });
          return updated;
        });
      
      // Apply this match to items with EXACT same song name
      newPreview.forEach((previewItem, idx) => {
        if (previewItem.originalSongName === originalSongName) {
          previewItem.songId = song.id;
          previewItem.songName = song.name;
          previewItem.manualSongName = song.name;
          previewItem.songMatch = 'manual';
          
          // Update status
          if (previewItem.pitchRecognized) {
            previewItem.status = 'ready';
            previewItem.errorMessage = undefined;
          } else {
            previewItem.status = 'needs_pitch';
          }
          
          exactMatchCount++;
        } else if (previewItem.status === 'needs_song') {
          // Find similar unmatched items (similarity >= 80%)
          const topMatches = findTopSongMatches(previewItem.originalSongName, [song], 1);
          if (topMatches.length > 0 && topMatches[0].similarity >= 80) {
            similarUnmatched.push({
              index: idx,
              name: previewItem.originalSongName,
              similarity: topMatches[0].similarity,
            });
          }
        }
      });
      
      // If we found similar unmatched items, prompt user to apply
      if (similarUnmatched.length > 0) {
        const similarNames = similarUnmatched.map(s => `"${s.name}" (${s.similarity}%)`).join(', ');
        const applyToSimilar = window.confirm(
          `Found ${similarUnmatched.length} similar unmatched song(s):\n\n${similarNames}\n\nApply the match "${song.name}" to these as well?`
        );
        
        if (applyToSimilar) {
          let similarCount = 0;
          for (const { index: idx } of similarUnmatched) {
            const previewItem = newPreview[idx];
            
            // Save mapping for this similar name too
            await saveSongMapping(previewItem.originalSongName, song.id, song.name);
            
            previewItem.songId = song.id;
            previewItem.songName = song.name;
            previewItem.manualSongName = song.name;
            previewItem.songMatch = 'manual';
            
            if (previewItem.pitchRecognized) {
              previewItem.status = 'ready';
              previewItem.errorMessage = undefined;
            } else {
              previewItem.status = 'needs_pitch';
            }
            
            similarCount++;
          }
        }
      }
      }
      
      // Re-sort to move matched items down and unmatched items to top
      const sortedPreview = sortPreview(newPreview);
      setPreviewItems(sortedPreview);
      setEditingItemIndex(null);
      setManualSongInput('');
    } catch (error) {
      console.error('❌ ERROR in handleManualSongName:', error);
      alert(`Error saving song mapping: ${error}`);
    }
  };
  
  const handleManualPitch = async (index: number, originalPitch: string, normalizedPitch: string) => {
    try {
      const newPreview = [...previewItems];
      
      if (!normalizedPitch) {
        return;
      }
      
      // Clean the original pitch the same way normalizePitch() does
      const cleanedPitch = cleanPitchFormat(originalPitch);
      
      // Add mapping globally (runtime) using cleaned format
      addPitchMapping(cleanedPitch, normalizedPitch);
      
      // Save mapping for future imports (persistent) using cleaned format
      await savePitchMapping(cleanedPitch, normalizedPitch);
    
    let exactMatchCount = 0;
    const similarUnmatched: Array<{ index: number; pitch: string }> = [];
    
    // Apply this pitch mapping to ALL items with the EXACT same original pitch
    newPreview.forEach((previewItem, idx) => {
      if (previewItem.csvData.pitch === originalPitch) {
        previewItem.normalizedPitch = normalizedPitch;
        previewItem.pitchRecognized = true;
        
        // Update status
        if (previewItem.songId) {
          previewItem.status = 'ready';
          previewItem.errorMessage = undefined;
        } else {
          previewItem.status = 'needs_song';
        }
        
        exactMatchCount++;
      } else if (previewItem.status === 'needs_pitch' || !previewItem.pitchRecognized) {
        // Find items with VERY similar pitch formats (differ by 1-2 chars, e.g., "5M" vs "5 M")
        const pitch1 = originalPitch.toLowerCase().replace(/\s+/g, '');
        const pitch2 = previewItem.csvData.pitch.toLowerCase().replace(/\s+/g, '');
        
        // Check if pitches are similar (same after removing spaces, or differ by only case)
        if (pitch1 === pitch2 && originalPitch !== previewItem.csvData.pitch) {
          similarUnmatched.push({
            index: idx,
            pitch: previewItem.csvData.pitch,
          });
        }
      }
    });
    
    // If we found similar unmatched items (e.g., "5M" vs "5 M"), prompt user
    if (similarUnmatched.length > 0) {
      const similarFormats = similarUnmatched.map(s => `"${s.pitch}"`).join(', ');
      const applyToSimilar = window.confirm(
        `Found ${similarUnmatched.length} similar pitch format(s):\n\n${similarFormats}\n\nApply the same mapping "${normalizedPitch}" to these as well?`
      );
      
      if (applyToSimilar) {
        let similarCount = 0;
        for (const { index: idx, pitch } of similarUnmatched) {
          const previewItem = newPreview[idx];
          
          // Clean this variant the same way
          const cleanedVariant = cleanPitchFormat(pitch);
          
          // Add mapping for this variant too using cleaned format
          addPitchMapping(cleanedVariant, normalizedPitch);
          await savePitchMapping(cleanedVariant, normalizedPitch);
          
          previewItem.normalizedPitch = normalizedPitch;
          previewItem.pitchRecognized = true;
          
          if (previewItem.songId) {
            previewItem.status = 'ready';
            previewItem.errorMessage = undefined;
          } else {
            previewItem.status = 'needs_song';
          }
          
          similarCount++;
        }
      }
    }
    
      // Re-sort to move matched items down and unmatched items to top
      const sortedPreview = sortPreview(newPreview);
      setPreviewItems(sortedPreview);
      setEditingItemIndex(null);
      setManualPitchInput('');
    } catch (error) {
      console.error('❌ ERROR in handleManualPitch:', error);
      alert(`Error saving pitch mapping: ${error}`);
    }
  };
  
  const handleUndoSongMatch = async (index: number) => {
    const item = previewItems[index];
    
    // Ask for confirmation
    const confirmed = window.confirm(
      `Undo song match for "${item.originalSongName}"?\n\n` +
      `This will:\n` +
      `- Clear the manual match\n` +
      `- Delete the stored mapping from database\n` +
      `- Reset this row to "needs song match" status`
    );
    
    if (!confirmed) return;
    
    try {
      // Delete the stored mapping
      await deleteSongMapping(item.originalSongName);
      
      // Also remove from in-memory map
      const normalizedKey = normalizeSongNameForMapping(item.originalSongName);
      setSongMappings(prev => {
        const updated = new Map(prev);
        updated.delete(normalizedKey);
        return updated;
      });
      
      // Reset the preview item
      const newPreview = [...previewItems];
      newPreview[index] = {
        ...item,
        songId: undefined,
        songName: item.originalSongName,
        songMatch: 'none',
        manualSongName: undefined,
        status: 'needs_song',
        errorMessage: 'No matching song found',
      };
      
      // Re-sort to move unmatched item back to top
      const sortedPreview = sortPreview(newPreview);
      setPreviewItems(sortedPreview);
    } catch (error) {
      console.error('Error undoing song match:', error);
      alert(`Error undoing match: ${error}`);
    }
  };
  
  const handleUndoPitchMatch = async (index: number) => {
    const item = previewItems[index];
    
    // Ask for confirmation
    const confirmed = window.confirm(
      `Undo pitch mapping for "${item.csvData.pitch}"?\n\n` +
      `This will:\n` +
      `- Clear the pitch mapping\n` +
      `- Delete the stored mapping from database\n` +
      `- Reset this row to "needs pitch mapping" status`
    );
    
    if (!confirmed) return;
    
    try {
      // Clean the pitch format the same way normalizePitch() does
      const cleanedPitch = cleanPitchFormat(item.csvData.pitch);
      
      // Delete the stored mapping from database using cleaned format
      await deletePitchMapping(cleanedPitch);
      
      // Remove from in-memory cache using cleaned format
      removePitchMapping(cleanedPitch);
      
      // Reset the preview item
      const newPreview = [...previewItems];
      newPreview[index] = {
        ...item,
        normalizedPitch: undefined,
        pitchRecognized: false,
        status: item.songId ? 'needs_pitch' : 'needs_song', // Depends on whether song is matched
        errorMessage: `Pitch format "${item.csvData.pitch}" not recognized`,
      };
      
      // Re-sort to move unmatched item back to top
      const sortedPreview = sortPreview(newPreview);
      setPreviewItems(sortedPreview);
    } catch (error) {
      console.error('Error undoing pitch match:', error);
      alert(`Error undoing pitch mapping: ${error}`);
    }
  };
  
  const handleImport = async () => {
    setCurrentStep('importing');
    
    const result = await CsvImportService.executeImport(previewItems, singers);
    setImportResult(result);
    setCurrentStep('complete');
  };
  
  const handleAutoMatchAll = () => {
    const newPreview = [...previewItems];
    let matchedCount = 0;
    
    newPreview.forEach((item, index) => {
      // Auto-match songs with lower threshold (80%)
      if (item.status === 'needs_song') {
        const topMatches = findTopSongMatches(item.originalSongName, songs, 1);
        if (topMatches.length > 0 && topMatches[0].similarity >= 80) {
          item.songId = topMatches[0].song.id;
          item.songName = topMatches[0].song.name;
          item.songMatch = 'fuzzy';
          item.songSimilarity = topMatches[0].similarity;
          
          if (item.pitchRecognized) {
            item.status = 'ready';
            item.errorMessage = undefined;
            matchedCount++;
          } else {
            item.status = 'needs_pitch';
          }
        }
      }
    });
    
    setPreviewItems(newPreview);
    alert(`Auto-matched ${matchedCount} songs! Review and import when ready.`);
  };
  
  const handleSkipUnmatched = () => {
    const newPreview = previewItems.filter(item => item.status === 'ready');
    setPreviewItems(newPreview);
  };
  
  const handleExportUnmatched = () => {
    const unmatchedSongs = previewItems.filter(item => item.status === 'needs_song');
    const unmatchedPitches = previewItems.filter(item => item.status === 'needs_pitch');
    
    let csv = 'Song Title,Singer,Pitch,Issue\n';
    
    unmatchedSongs.forEach(item => {
      csv += `"${item.originalSongName}",${item.singerName},${item.csvData.pitch},"No matching song"\n`;
    });
    
    unmatchedPitches.forEach(item => {
      csv += `"${item.originalSongName}",${item.singerName},${item.csvData.pitch},"Pitch format not recognized"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unmatched-songs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleStartScraping = async () => {
    setCurrentStep('scraping');
    setScrapeProgress('Ready to import CSV data. Follow the instructions below.');
  };
  
  const handleReset = () => {
    setCurrentStep('instructions');
    setScrapedData([]);
    setPreviewItems([]);
    setImportResult(null);
    setScrapeProgress('');
    setEditingItemIndex(null);
    setManualSongInput('');
    setManualPitchInput('');
  };
  
  const readyCount = previewItems.filter(item => item.status === 'ready').length;
  const needsSongCount = previewItems.filter(item => item.status === 'needs_song').length;
  const needsPitchCount = previewItems.filter(item => item.status === 'needs_pitch').length;
  const droppedCount = previewItems.filter(item => item.status === 'dropped').length;
  
  if (singersLoading || songsLoading) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold mb-4">Singers and Pitches Import</h2>
        
        {/* Instructions Step */}
        {currentStep === 'instructions' && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">📋 CSV Import Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Prepare a CSV file with 3 columns: <strong>Song Title, Singer, Pitch</strong></li>
                <li>Click "Start Import" below to paste your CSV data</li>
                <li>Review the preview to see matched and unmatched items</li>
                <li>For unmatched songs, manually select the correct song from the dropdown</li>
                <li>For unrecognized pitches, map them to standard pitch notation</li>
                <li>Confirm and import all ready items</li>
              </ol>
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Example CSV format:</p>
                <pre className="text-xs font-mono text-gray-600 dark:text-gray-400">Song Title,Singer,Pitch
Om Namah Shivaya,Shambhavi,G
Raghu Pathey,Ameya,4m</pre>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">💡 Tips:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>You can import data from any external source in CSV format</li>
                <li>You can create the CSV in Excel/Google Sheets and copy-paste</li>
                <li>Make sure column order is: Song Title, Singer, Pitch</li>
                <li>The tool will automatically match songs and create new singers as needed</li>
              </ul>
            </div>
            
            <button
              onClick={handleStartScraping}
              className="btn btn-primary"
            >
              Start Import
            </button>
          </div>
        )}
        
        {/* CSV Input Step */}
        {currentStep === 'scraping' && (
          <div className="space-y-4">
            {scrapeProgress && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300">{scrapeProgress}</p>
              </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="font-semibold mb-2">📋 CSV Import Instructions</p>
              <p className="text-sm mb-3">Prepare your CSV file with 3 columns:</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li><strong>Song Title</strong> - The name of the bhajan</li>
                <li><strong>Singer</strong> - Singer's name</li>
                <li><strong>Pitch</strong> - The pitch/key (e.g., G, 4m, C major)</li>
              </ol>
              <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mb-1">Example CSV format:</p>
                <pre className="text-xs font-mono text-gray-600 dark:text-gray-400">
Song Title,Singer,Pitch
Om Namah Shivaya,Shambhavi,G
Raghu Pathey,Ameya,4m
Why fear when I am here,Ameya,5m</pre>
              </div>
              <p className="text-xs mt-3 text-gray-600 dark:text-gray-400">
                💡 Tip: You can create this in Excel/Google Sheets and copy-paste directly, or format manually with commas.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Paste CSV data (Song Title, Singer, Pitch):
              </label>
              <textarea
                className="w-full h-64 p-2 border rounded font-mono text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                placeholder="Song Title,Singer,Pitch&#10;Example:&#10;Raghu Pathey Raaghava Raja Rama,Ameya,4m&#10;Why fear when I am here,Ameya,5m&#10;Om Namah Shivaya,Shambhavi,G"
                onChange={(e) => {
                  // Parse CSV data (Song Title, Singer, Pitch)
                  const lines = e.target.value.split('\n');
                  const parsed: CsvPitchData[] = [];
                  
                  // Proper CSV parser that handles quoted fields with commas
                  const parseCSVLine = (line: string): string[] => {
                    const fields: string[] = [];
                    let currentField = '';
                    let insideQuotes = false;
                    
                    for (let i = 0; i < line.length; i++) {
                      const char = line[i];
                      const nextChar = line[i + 1];
                      
                      if (char === '"') {
                        // Handle escaped quotes ("")
                        if (insideQuotes && nextChar === '"') {
                          currentField += '"';
                          i++; // Skip next quote
                        } else {
                          // Toggle quote state
                          insideQuotes = !insideQuotes;
                        }
                      } else if (char === ',' && !insideQuotes) {
                        // Field separator (only outside quotes)
                        fields.push(currentField.trim());
                        currentField = '';
                      } else {
                        currentField += char;
                      }
                    }
                    
                    // Add last field
                    fields.push(currentField.trim());
                    return fields;
                  };
                  
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    // Skip header row if present
                    if (line.toLowerCase().includes('song') && line.toLowerCase().includes('singer')) continue;
                    
                    const parts = parseCSVLine(line);
                    
                    if (parts.length >= 3) {
                      // Remove trailing punctuation (commas, periods, etc) and extra spaces
                      const songName = parts[0].replace(/[,.\s]+$/, '').trim();
                      const singerName = parts[1].trim();
                      const pitch = parts[2].trim();
                      
                      parsed.push({
                        songName,
                        singerName,
                        pitch,
                      });
                    }
                  }
                  
                  setScrapedData(parsed);
                  if (parsed.length > 0) {
                    setScrapeProgress(`✅ Parsed ${parsed.length} rows successfully!`);
                  } else if (e.target.value.trim()) {
                    setScrapeProgress('⚠️ No valid data found. Format: Song Title,Singer,Pitch');
                  } else {
                    setScrapeProgress('');
                  }
                }}
              />
              {scrapeProgress && (
                <p className="mt-2 text-sm font-medium">{scrapeProgress}</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => generatePreview()}
                disabled={scrapedData.length === 0}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Process Data {scrapedData.length > 0 ? `(${scrapedData.length} rows)` : ''}
              </button>
              <button
                onClick={handleReset}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Preview Step */}
        {currentStep === 'preview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">{readyCount}</div>
                <div className="text-sm">Ready to Import</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
                <div className="text-2xl font-bold text-yellow-600">{needsSongCount}</div>
                <div className="text-sm">Need Song Match</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded">
                <div className="text-2xl font-bold text-orange-600">{needsPitchCount}</div>
                <div className="text-sm">Need Pitch Mapping</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
                <div className="text-2xl font-bold text-red-600">{droppedCount}</div>
                <div className="text-sm">Dropped (No Pitch)</div>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-96 border rounded">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Singer</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Original Song</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Matched Song</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Original Pitch</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Normalized</th>
                    <th className="px-4 py-2 text-left text-xs font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {previewItems.map((item, index) => (
                    <tr key={index} className={
                      item.status === 'ready' ? 'bg-green-50 dark:bg-green-900/10' :
                      item.status === 'needs_song' ? 'bg-yellow-50 dark:bg-yellow-900/10' :
                      item.status === 'needs_pitch' ? 'bg-orange-50 dark:bg-orange-900/10' :
                      item.status === 'dropped' ? 'bg-red-50 dark:bg-red-900/10' :
                      'bg-gray-50 dark:bg-gray-900/10'
                    }>
                      <td className="px-4 py-2 text-xs">
                        {item.status === 'ready' && '✅ Ready'}
                        {item.status === 'needs_song' && '⚠️ Song'}
                        {item.status === 'needs_pitch' && '⚠️ Pitch'}
                        {item.status === 'dropped' && '🗑️ Dropped'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {item.singerName}
                        {!item.singerExists && ' (New)'}
                      </td>
                      <td className="px-4 py-2 text-xs">{item.originalSongName}</td>
                      <td className="px-4 py-2 text-xs">
                        {item.songName}
                        {item.songMatch === 'fuzzy' && (
                          <span className="ml-1 text-yellow-600">({item.songSimilarity}%)</span>
                        )}
                        {item.songMatch === 'manual' && (
                          <span className="ml-1 text-blue-600">(Manual)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {item.csvData.pitch}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {item.normalizedPitch || '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {item.status === 'dropped' && (
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            {item.errorMessage}
                          </span>
                        )}
                        {item.status === 'needs_song' && editingItemIndex !== index && (
                          <button
                            onClick={() => {
                              setEditingItemIndex(index);
                              const topMatches = findTopSongMatches(item.originalSongName, songs, 10);
                              if (topMatches.length > 0) {
                                setManualSongInput(topMatches[0].song.id || '');
                              }
                            }}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Select Song
                          </button>
                        )}
                        {item.status === 'needs_song' && editingItemIndex === index && (
                          <div className="flex gap-1 items-center">
                            <select
                              value={manualSongInput}
                              onChange={(e) => setManualSongInput(e.target.value)}
                              className="text-xs p-1 border rounded w-64"
                              autoFocus
                            >
                              <option value="">-- Select Song --</option>
                              {findTopSongMatches(item.originalSongName, songs, 10).map(match => (
                                <option key={match.song.id} value={match.song.id}>
                                  {match.song.name} ({match.similarity}%)
                                </option>
                              ))}
                              <optgroup label="All Songs">
                                {songs
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(song => (
                                    <option key={song.id} value={song.id}>
                                      {song.name}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            <button
                              onClick={() => handleManualSongName(index, manualSongInput)}
                              disabled={!manualSongInput}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemIndex(null);
                                setManualSongInput('');
                              }}
                              className="text-xs bg-gray-400 text-white px-2 py-1 rounded"
                            >
                              ✗
                            </button>
                          </div>
                        )}
                        {item.status === 'needs_pitch' && editingItemIndex !== index && (
                          <button
                            onClick={() => {
                              setEditingItemIndex(index);
                              setManualPitchInput('');
                            }}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Map Pitch
                          </button>
                        )}
                        {item.status === 'needs_pitch' && editingItemIndex === index && (
                          <div className="flex gap-1 items-center">
                            <select
                              value={manualPitchInput}
                              onChange={(e) => setManualPitchInput(e.target.value)}
                              className="text-xs p-1 border rounded w-32"
                              autoFocus
                            >
                              <option value="">-- Select Pitch --</option>
                              <optgroup label="Basic">
                                <option value="C">C</option>
                                <option value="C#">C#</option>
                                <option value="D">D</option>
                                <option value="D#">D#</option>
                                <option value="E">E</option>
                                <option value="F">F</option>
                                <option value="F#">F#</option>
                                <option value="G">G</option>
                                <option value="G#">G#</option>
                                <option value="A">A</option>
                                <option value="A#">A#</option>
                                <option value="B">B</option>
                              </optgroup>
                              <optgroup label="Major">
                                {availablePitches.filter(p => p.includes('major')).map(pitch => (
                                  <option key={pitch} value={pitch}>{pitch}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Minor">
                                {availablePitches.filter(p => p.includes('minor')).map(pitch => (
                                  <option key={pitch} value={pitch}>{pitch}</option>
                                ))}
                              </optgroup>
                              <optgroup label="Madhyam">
                                {availablePitches.filter(p => p.includes('Madhyam')).map(pitch => (
                                  <option key={pitch} value={pitch}>{pitch}</option>
                                ))}
                              </optgroup>
                            </select>
                            <button
                              onClick={() => handleManualPitch(index, item.csvData.pitch, manualPitchInput)}
                              disabled={!manualPitchInput}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => {
                                setEditingItemIndex(null);
                                setManualPitchInput('');
                              }}
                              className="text-xs bg-gray-400 text-white px-2 py-1 rounded"
                            >
                              ✗
                            </button>
                          </div>
                        )}
                        {item.status === 'ready' && item.songMatch === 'manual' && (
                          <button
                            onClick={() => handleUndoSongMatch(index)}
                            className="text-orange-600 hover:underline text-xs"
                            title="Undo this manual song match"
                          >
                            ↶ Undo Song
                          </button>
                        )}
                        {item.status === 'ready' && item.pitchRecognized && item.songMatch !== 'manual' && (
                          <button
                            onClick={() => handleUndoPitchMatch(index)}
                            className="text-orange-600 hover:underline text-xs"
                            title="Undo this pitch mapping"
                          >
                            ↶ Undo Pitch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleImport}
                disabled={readyCount === 0}
                className="btn btn-primary"
              >
                Import {readyCount} Ready Item{readyCount !== 1 ? 's' : ''}
              </button>
              
              {(needsSongCount > 0 || needsPitchCount > 0) && (
                <>
                  <button
                    onClick={handleAutoMatchAll}
                    className="btn bg-green-600 hover:bg-green-700 text-white"
                  >
                    🤖 Auto-Match All (80% threshold)
                  </button>
                  
                  <button
                    onClick={handleSkipUnmatched}
                    className="btn bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Skip Unmatched
                  </button>
                  
                  <button
                    onClick={handleExportUnmatched}
                    className="btn bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    📥 Export Unmatched CSV
                  </button>
                </>
              )}
              
              <button
                onClick={handleReset}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
            
            {(needsSongCount > 0 || needsPitchCount > 0) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded">
                <h4 className="font-semibold mb-2">⚡ Quick Actions for Large Imports:</h4>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {needsSongCount > 0 && (
                    <li>
                      <strong>{needsSongCount}</strong> song{needsSongCount !== 1 ? 's' : ''} need matching. 
                      Use "Auto-Match All" to match with 80% threshold, or manually select individual songs.
                    </li>
                  )}
                  {needsPitchCount > 0 && (
                    <li>
                      <strong>{needsPitchCount}</strong> pitch{needsPitchCount !== 1 ? 'es' : ''} need mapping. 
                      Map them individually or export to CSV for batch processing.
                    </li>
                  )}
                  <li>
                    <strong>Tip:</strong> Import ready items first ({readyCount} ready), then handle unmatched ones separately.
                  </li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Importing Step */}
        {currentStep === 'importing' && (
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Importing data...
            </p>
          </div>
        )}
        
        {/* Complete Step */}
        {currentStep === 'complete' && importResult && (
          <div className="space-y-4">
            <div className={`p-6 rounded-lg ${
              importResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <h3 className="text-xl font-bold mb-4">
                {importResult.success ? '✅ Import Complete!' : '⚠️ Import Completed with Errors'}
              </h3>
              
              <div className="space-y-2">
                <p>Singers Created: <strong>{importResult.singersCreated}</strong></p>
                <p>Pitches Created: <strong>{importResult.pitchesCreated}</strong></p>
                <p>Pitches Updated: <strong>{importResult.pitchesUpdated}</strong></p>
                <p>Pitches Skipped (Already Exist): <strong>{importResult.pitchesSkipped}</strong></p>
              </div>
              
              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Errors:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-red-600 dark:text-red-400">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <button
              onClick={handleReset}
              className="btn btn-primary"
            >
              Import More Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

