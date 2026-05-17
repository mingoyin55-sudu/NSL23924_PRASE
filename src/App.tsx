import { UploadCloud, FileDown, Trash2 } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { parseProtocol, extractDataFromCsv, exportToCsv, ParsedCommand } from './lib/parser';

export default function App() {
  const [commands, setCommands] = useState<ParsedCommand[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedData = extractDataFromCsv(text);
        if (parsedData.length === 0) {
          setError('未能从CSV中提取到有效的Hex数据。请检查文件格式。');
          setCommands([]);
        } else {
          const parsedCommands = parseProtocol(parsedData);
          setCommands(parsedCommands);
        }
      } catch (err) {
        setError('解析文件时发生错误。');
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError('读取文件失败。');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (commands.length === 0) return;
    const csvStr = exportToCsv(commands);
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NSL23924_解析结果_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    setCommands([]);
    setFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">NSL23924 逻辑分析仪命令解析工具</h1>
            <p className="text-gray-500 mt-1 text-sm">上传逻辑分析仪导出的CSV数据，自动提取UART通信帧并生成易读的参数配置解释。</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex gap-3">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
              <UploadCloud size={18} />
              <span>选择 CSV 文件</span>
            </button>
            {commands.length > 0 && (
              <>
                <button 
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <FileDown size={18} />
                  <span>导出 解析结果</span>
                </button>
                <button 
                  onClick={clearData}
                  className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Trash2 size={18} />
                  <span>清空</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Data/Status Overview */}
        {isProcessing && (
          <div className="p-8 text-center text-blue-600 font-medium">数据处理中，请稍候...</div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg shadow-sm">
            {error}
          </div>
        )}

        {/* Table Section */}
        {!isProcessing && commands.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">
                解析结果 <span className="ml-2 text-sm font-normal text-gray-500">共解析到 {commands.length} 条指令</span>
              </h2>
              {fileName && <span className="text-sm text-gray-500 font-mono text-right">来源文件: {fileName}</span>}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left align-middle whitespace-nowrap">
                <thead className="text-xs text-gray-600 uppercase bg-gray-50/80 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-16 text-center">序号</th>
                    <th className="px-4 py-3 font-semibold">起始时间</th>
                    <th className="px-4 py-3 font-semibold">类型</th>
                    <th className="px-4 py-3 font-semibold">设备地址</th>
                    <th className="px-4 py-3 font-semibold">寄存器</th>
                    <th className="px-4 py-3 font-semibold">数据 (Hex)</th>
                    <th className="px-4 py-3 font-semibold w-1/3">自然语言解析功能</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commands.map((cmd) => (
                    <tr key={cmd.index} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-4 py-3 text-center text-gray-500 font-mono">{cmd.index}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono whitespace-nowrap">{cmd.startTime || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          cmd.isWrite ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {cmd.isWrite ? '写入' : '读取'}
                        </span>
                        {cmd.isBroadcast && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            广播
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">0x{cmd.deviceAddr.toString(16).toUpperCase().padStart(2, '0')}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 mr-2">
                            0x{cmd.regAddr.toString(16).toUpperCase().padStart(2, '0')}
                          </span>
                          <span className="font-medium text-gray-700">{cmd.regName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600 max-w-xs truncate" title={cmd.data.map(h => "0x" + h.toString(16).toUpperCase().padStart(2, "0")).join(', ')}>
                        {cmd.data.slice(0, 4).map(h => "0x" + h.toString(16).toUpperCase().padStart(2, "0")).join(', ')}
                        {cmd.data.length > 4 ? ` ... (+${cmd.data.length - 4})` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-800 whitespace-normal min-w-[300px]">
                        {cmd.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isProcessing && commands.length === 0 && !error && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed p-16 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
               <FileDown size={32} />
             </div>
             <h3 className="text-lg font-medium text-gray-900 mb-2">暂无解析数据</h3>
             <p className="text-gray-500 max-w-md mx-auto mb-6">
               请上传包含NSL23924通信波形的CSV文件。系统会自动提取 `0x55` 帧起始，解析通信格式，并转换为带寄存器定义的直观信息。
             </p>
             <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              浏览并上传文件
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
