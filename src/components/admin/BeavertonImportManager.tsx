import React, { useState, useEffect } from 'react';
import { useSingers } from '../../contexts/SingerContext';
import { useSongs } from '../../contexts/SongContext';
import { BeavertonScraperService, type BeavertonPitchData } from '../../services/BeavertonScraperService';
import { BeavertonImportService, type ImportPreviewItem, type ImportResult } from '../../services/BeavertonImportService';
import { normalizePitch, addPitchMapping } from '../../utils/pitchNormalization';
import { findTopSongMatches } from '../../utils/songMatcher';
import { LoadingSpinner } from '../common/LoadingSpinner';

type ImportStep = 'instructions' | 'scraping' | 'preview' | 'importing' | 'complete';

export const BeavertonImportManager: React.FC = () => {
  const { singers, loading: singersLoading } = useSingers();
  const { songs, loading: songsLoading } = useSongs();
  
  const [currentStep, setCurrentStep] = useState<ImportStep>('instructions');
  const [scrapedData, setScrapedData] = useState<BeavertonPitchData[]>([]);
  const [previewItems, setPreviewItems] = useState<ImportPreviewItem[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [scrapeProgress, setScrapeProgress] = useState<string>('');
  
  // Manual input states
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [manualSongInput, setManualSongInput] = useState<string>('');
  const [manualPitchInput, setManualPitchInput] = useState<string>('');
  
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
  
  // Generate preview when scraped data changes
  useEffect(() => {
    if (scrapedData.length > 0 && !singersLoading && !songsLoading) {
      generatePreview();
    }
  }, [scrapedData, singersLoading, songsLoading]);
  
  const generatePreview = async () => {
    const preview = await BeavertonImportService.createImportPreview(
      scrapedData,
      singers,
      songs
    );
    setPreviewItems(preview);
    setCurrentStep('preview');
  };
  
  const handleManualSongName = (index: number, songId: string) => {
    const newPreview = [...previewItems];
    const item = newPreview[index];
    
    // Find song by ID
    const song = songs.find(s => s.id === songId);
    
    if (song) {
      item.songId = song.id;
      item.songName = song.name;
      item.manualSongName = song.name;
      item.songMatch = 'manual';
      
      // Update status
      if (item.pitchRecognized) {
        item.status = 'ready';
        item.errorMessage = undefined;
      } else {
        item.status = 'needs_pitch';
      }
    }
    
    setPreviewItems(newPreview);
    setEditingItemIndex(null);
    setManualSongInput('');
  };
  
  const handleManualPitch = (index: number, originalPitch: string, normalizedPitch: string) => {
    const newPreview = [...previewItems];
    const item = newPreview[index];
    
    if (!normalizedPitch) {
      return;
    }
    
    // Add mapping
    addPitchMapping(originalPitch, normalizedPitch);
    
    item.normalizedPitch = normalizedPitch;
    item.pitchRecognized = true;
    
    // Update status
    if (item.songId) {
      item.status = 'ready';
      item.errorMessage = undefined;
    } else {
      item.status = 'needs_song';
    }
    
    setPreviewItems(newPreview);
    setEditingItemIndex(null);
    setManualPitchInput('');
  };
  
  const handleImport = async () => {
    setCurrentStep('importing');
    
    const result = await BeavertonImportService.executeImport(previewItems, singers);
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
    
    let csv = 'Type,Singer,Original Song,Beaverton Pitch,Issue\n';
    
    unmatchedSongs.forEach(item => {
      csv += `Song,${item.singerName},${item.originalSongName},${item.beavertonData.pitch},"No matching song"\n`;
    });
    
    unmatchedPitches.forEach(item => {
      csv += `Pitch,${item.singerName},${item.originalSongName},${item.beavertonData.pitch},"Pitch format not recognized"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beaverton-unmatched-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleStartScraping = async () => {
    setCurrentStep('scraping');
    setScrapeProgress('Opening Beaverton website...');
    
    // Open the browser window - user will manually scrape and paste data
    window.open(BeavertonScraperService.getUrl(), '_blank', 'width=1400,height=900');
    
    setScrapeProgress('Browser window opened. Follow the instructions below to scrape data.');
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
              <h3 className="font-semibold mb-2">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-2">
                <li>Click "Start Scraping" below to open the Beaverton website</li>
                <li>Once the page loads, enable the "IGNORE UPPER TABLE FILTERS" checkbox</li>
                <li>The tool will automatically iterate through A-Z in the singer search</li>
                <li>You'll see a preview of all data before importing</li>
                <li>For unmatched songs, you'll be prompted to enter the exact song name</li>
                <li>For unrecognized pitches, you'll be prompted to map them</li>
                <li>Review and confirm before final import</li>
              </ol>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Note:</h3>
              <p>This process will open a browser window. Please keep it open until scraping completes.</p>
            </div>
            
            <button
              onClick={handleStartScraping}
              className="btn btn-primary"
            >
              Start Scraping
            </button>
          </div>
        )}
        
        {/* Scraping Step */}
        {currentStep === 'scraping' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Scraping data from Beaverton Sai Bhajans...
              </p>
              {scrapeProgress && (
                <p className="mt-2 text-sm text-gray-500">{scrapeProgress}</p>
              )}
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="font-semibold mb-2">🌐 Browser Window Opened!</p>
              <p className="text-sm mb-3">Follow these steps in the opened window:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Wait for the Beaverton site to load completely</li>
                <li>Look for and enable the <strong>"IGNORE UPPER TABLE FILTERS"</strong> checkbox (important!)</li>
                <li>Click on the "Singer Search" tab at the top</li>
                <li>In the "Search Singer Here" box, enter each letter one by one (A, then B, then C, etc.)</li>
                <li>After each letter search, the table will update with matching singers</li>
                <li>Select and copy ALL the table rows (Singer | Pitch | Song | Deity | Language)</li>
                <li>Paste into the text area below</li>
                <li>Repeat for all 26 letters (A-Z)</li>
                <li>Once done, click "Process Data"</li>
              </ol>
              <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                💡 Tip: You can copy-paste from Excel/Google Sheets and save as CSV, or manually format with commas.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Paste scraped data (CSV format):
              </label>
              <textarea
                className="w-full h-64 p-2 border rounded font-mono text-sm"
                placeholder="Singer Name,Pitch,Song Name,Deity,Language&#10;Example:&#10;Ameya,4m,Raghu Pathey Raaghava Raja Rama,Ram,Sanskrit&#10;Ameya,5m,Why fear when I am here,Sai Baba,English"
                onChange={(e) => {
                  // Parse CSV data
                  const lines = e.target.value.split('\n');
                  const parsed: BeavertonPitchData[] = [];
                  
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    const parts = line.split(',').map(p => p.trim());
                    if (parts.length >= 3) {
                      parsed.push({
                        singerName: parts[0],
                        pitch: parts[1],
                        songName: parts[2],
                        deity: parts[3] || undefined,
                        language: parts[4] || undefined,
                      });
                    }
                  }
                  
                  setScrapedData(parsed);
                  if (parsed.length > 0) {
                    setScrapeProgress(`✅ Parsed ${parsed.length} rows successfully!`);
                  } else if (e.target.value.trim()) {
                    setScrapeProgress('⚠️ No valid data found. Make sure columns are separated by commas.');
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
            <div className="grid grid-cols-3 gap-4 mb-4">
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
                      'bg-orange-50 dark:bg-orange-900/10'
                    }>
                      <td className="px-4 py-2 text-xs">
                        {item.status === 'ready' && '✅ Ready'}
                        {item.status === 'needs_song' && '⚠️ Song'}
                        {item.status === 'needs_pitch' && '⚠️ Pitch'}
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
                        {item.beavertonData.pitch}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">
                        {item.normalizedPitch || '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">
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
                              onClick={() => handleManualPitch(index, item.beavertonData.pitch, manualPitchInput)}
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

