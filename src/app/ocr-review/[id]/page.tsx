'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Edit3,
  Save,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  Plus,
  Trash2,
  Scissors,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface ExtractedQuestion {
  number: number;
  text: string;
  type?: string;
  groupId?: string;
  groupLabel?: string;
}

interface QuestionGroup {
  id: string;
  label: string;
  questionNumbers: number[];
  sharedPassage?: string;
}

interface OcrData {
  status: string;
  step: string;
  progress: number;
  questions?: ExtractedQuestion[];
  error?: string;
  answerKey?: string;
}

export default function OcrReviewPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [data, setData] = useState<OcrData | null>(null);
  const [editedQuestions, setEditedQuestions] = useState<ExtractedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<QuestionGroup[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        if (result.data.questions && editedQuestions.length === 0) {
          setEditedQuestions(result.data.questions);
          const initialAnswers: Record<number, string> = {};
          result.data.questions.forEach((q: ExtractedQuestion) => {
            initialAnswers[q.number] = '';
          });
          if (result.data.answerKey) {
            const keys = result.data.answerKey.split(',');
            result.data.questions.forEach((q: ExtractedQuestion, idx: number) => {
              if (keys[idx]) initialAnswers[q.number] = keys[idx].trim();
            });
          }
          setAnswers(initialAnswers);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [reportId, editedQuestions.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (data?.status === 'extracting') {
        fetchData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData, data?.status]);

  const toggleQuestionSelection = (questionNumber: number) => {
    setSelectedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionNumber)) {
        next.delete(questionNumber);
      } else {
        next.add(questionNumber);
      }
      return next;
    });
  };

  const selectRange = (startNum: number, endNum: number) => {
    const start = Math.min(startNum, endNum);
    const end = Math.max(startNum, endNum);
    const newSelection = new Set<number>();
    for (let i = start; i <= end; i++) {
      if (editedQuestions.some(q => q.number === i)) {
        newSelection.add(i);
      }
    }
    setSelectedQuestions(newSelection);
  };

  const createGroup = () => {
    if (selectedQuestions.size < 2) {
      alert('복합지문으로 묶으려면 2개 이상의 문제를 선택하세요.');
      return;
    }
    
    const sortedNums = Array.from(selectedQuestions).sort((a, b) => a - b);
    const defaultLabel = `${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}`;
    setNewGroupLabel(defaultLabel);
    setShowGroupDialog(true);
  };

  const confirmCreateGroup = () => {
    const sortedNums = Array.from(selectedQuestions).sort((a, b) => a - b);
    const groupId = `group-${Date.now()}`;
    const label = newGroupLabel || `${sortedNums[0]}-${sortedNums[sortedNums.length - 1]}`;
    
    const existingGroupIds = new Set<string>();
    editedQuestions.forEach(q => {
      if (selectedQuestions.has(q.number) && q.groupId) {
        existingGroupIds.add(q.groupId);
      }
    });
    setGroups(prev => prev.filter(g => !existingGroupIds.has(g.id)));

    const newGroup: QuestionGroup = {
      id: groupId,
      label: label,
      questionNumbers: sortedNums,
    };
    setGroups(prev => [...prev, newGroup]);

    setEditedQuestions(prev => prev.map(q => {
      if (selectedQuestions.has(q.number)) {
        return { ...q, groupId, groupLabel: label };
      }
      return q;
    }));

    setSelectedQuestions(new Set());
    setShowGroupDialog(false);
    setNewGroupLabel('');
  };

  const ungroupQuestions = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setEditedQuestions(prev => prev.map(q => {
      if (q.groupId === groupId) {
        return { ...q, groupId: undefined, groupLabel: undefined };
      }
      return q;
    }));
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const addQuestion = (afterIndex: number) => {
    const afterQuestion = editedQuestions[afterIndex];
    const newNumber = afterQuestion.number + 0.5;
    
    const newQuestion: ExtractedQuestion = {
      number: newNumber,
      text: '',
      type: undefined,
    };
    
    const newQuestions = [...editedQuestions];
    newQuestions.splice(afterIndex + 1, 0, newQuestion);
    
    const renumbered = newQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    
    setEditedQuestions(renumbered);
    
    const newAnswers: Record<number, string> = {};
    renumbered.forEach((q, idx) => {
      const oldNum = editedQuestions[idx]?.number;
      newAnswers[q.number] = oldNum ? (answers[oldNum] || '') : '';
    });
    setAnswers(newAnswers);
    
    setEditingIndex(afterIndex + 1);
  };

  const deleteQuestion = (index: number) => {
    if (editedQuestions.length <= 1) {
      alert('최소 1개의 문제가 필요합니다.');
      return;
    }
    
    const questionToDelete = editedQuestions[index];
    if (!confirm(`문제 ${questionToDelete.number}번을 삭제하시겠습니까?`)) {
      return;
    }
    
    const newQuestions = editedQuestions.filter((_, i) => i !== index);
    const renumbered = newQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    
    setEditedQuestions(renumbered);
    
    const newAnswers: Record<number, string> = {};
    renumbered.forEach(q => {
      newAnswers[q.number] = '';
    });
    newQuestions.forEach((q, idx) => {
      const newNum = idx + 1;
      newAnswers[newNum] = answers[q.number] || '';
    });
    setAnswers(newAnswers);
  };

  const splitQuestion = (index: number) => {
    const question = editedQuestions[index];
    const lines = question.text.split('\n');
    
    if (lines.length < 2) {
      alert('분리할 내용이 충분하지 않습니다.');
      return;
    }
    
    const midPoint = Math.floor(lines.length / 2);
    const firstPart = lines.slice(0, midPoint).join('\n');
    const secondPart = lines.slice(midPoint).join('\n');
    
    const newQuestions = [...editedQuestions];
    newQuestions[index] = { ...question, text: firstPart };
    newQuestions.splice(index + 1, 0, {
      number: question.number + 0.5,
      text: secondPart,
      type: question.type,
    });
    
    const renumbered = newQuestions.map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    
    setEditedQuestions(renumbered);
    
    const newAnswers: Record<number, string> = {};
    renumbered.forEach(q => {
      newAnswers[q.number] = '';
    });
    setAnswers(newAnswers);
  };

  const updateQuestion = (index: number, updates: Partial<ExtractedQuestion>) => {
    setEditedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    );
  };

  const updateAnswer = (questionNumber: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionNumber]: answer }));
  };

  const handleConfirmOcr = async () => {
    setIsSubmitting(true);
    try {
      const answerKey = editedQuestions.map(q => answers[q.number] || '').join(',');
      
      const questionsWithGroups = editedQuestions.map(q => ({
        ...q,
        groupId: q.groupId,
        groupLabel: q.groupLabel,
      }));
      
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_ocr',
          questions: questionsWithGroups,
          answerKey,
          groups,
        }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/match/${reportId}`);
      } else {
        alert(result.error || 'Failed');
      }
    } catch (error) {
      console.error('Confirm OCR error:', error);
      alert('Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQuestionTypeColor = (type?: string) => {
    if (!type) return 'bg-slate-100 text-slate-600';
    if (type.includes('어법')) return 'bg-green-100 text-green-700';
    if (type.includes('어휘')) return 'bg-purple-100 text-purple-700';
    if (type.includes('순서')) return 'bg-pink-100 text-pink-700';
    if (type.includes('삽입')) return 'bg-amber-100 text-amber-700';
    if (type.includes('빈칸')) return 'bg-red-100 text-red-700';
    if (type.includes('일치') || type.includes('불일치')) return 'bg-cyan-100 text-cyan-700';
    return 'bg-slate-100 text-slate-600';
  };

  const getGroupColor = (groupId?: string) => {
    if (!groupId) return '';
    const colors = [
      'border-l-4 border-l-pink-500 bg-pink-50/30',
      'border-l-4 border-l-purple-500 bg-purple-50/30',
      'border-l-4 border-l-green-500 bg-green-50/30',
      'border-l-4 border-l-amber-500 bg-amber-50/30',
      'border-l-4 border-l-pink-500 bg-pink-50/30',
    ];
    const groupIndex = groups.findIndex(g => g.id === groupId);
    return colors[groupIndex % colors.length];
  };

  const answeredCount = Object.values(answers).filter(a => a.trim()).length;
  const totalCount = editedQuestions.length;

  const getGroupedQuestions = () => {
    const result: { type: 'single' | 'group'; data: ExtractedQuestion | QuestionGroup; questions?: ExtractedQuestion[] }[] = [];
    const processedGroupIds = new Set<string>();
    
    editedQuestions.forEach((question, index) => {
      if (question.groupId && !processedGroupIds.has(question.groupId)) {
        const group = groups.find(g => g.id === question.groupId);
        if (group) {
          const groupQuestions = editedQuestions.filter(q => q.groupId === question.groupId);
          result.push({ type: 'group', data: group, questions: groupQuestions });
          processedGroupIds.add(question.groupId);
        }
      } else if (!question.groupId) {
        result.push({ type: 'single', data: question });
      }
    });
    
    return result;
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
      </div>
    );
  }

  if (data.status === 'extracting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">OCR 추출 중</span>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pink-500/25">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{data.step}</h1>
            <p className="text-slate-500 mb-8">PDF에서 텍스트를 추출하고 있습니다...</p>
            
            <div className="max-w-md mx-auto">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-600 transition-all duration-500"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">{Math.round(data.progress)}%</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-sm">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">오류 발생</h1>
          <p className="text-slate-500 mb-6">{data.error}</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 bg-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-pink-700 transition-colors"
          >
            다시 시도
          </Link>
        </div>
      </div>
    );
  }

  const groupedView = getGroupedQuestions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/upload" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">OCR 검토</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-slate-500">정답 입력: </span>
              <span className={answeredCount === totalCount ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {answeredCount}/{totalCount}
              </span>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {selectedQuestions.size > 0 && (
        <div className="sticky top-[73px] z-40 bg-pink-600 text-white shadow-lg">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-semibold">{selectedQuestions.size}개 선택됨</span>
              <span className="text-pink-200 text-sm">
                [{Array.from(selectedQuestions).sort((a, b) => a - b).join(', ')}]
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={createGroup}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
              >
                <Link2 className="w-4 h-4" />
                복합지문으로 묶기
              </button>
              <button
                onClick={() => setSelectedQuestions(new Set())}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
              >
                선택 해제
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-amber-800 text-sm font-semibold mb-2">
            Step 1: OCR 결과 검토
          </p>
          <ul className="text-amber-700 text-sm space-y-1">
            <li>• <strong>복합지문 묶기:</strong> 문제 번호 클릭하여 선택 → &quot;복합지문으로 묶기&quot; 버튼</li>
            <li>• OCR 오류 수정 (예: velther → neither)</li>
            <li>• 밑줄 단어 ①②③④⑤ 누락 여부 확인</li>
            <li>• <strong>각 문항의 정답을 입력하세요</strong> (정확한 분석을 위해 필수!)</li>
          </ul>
        </div>

        {groups.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-sm text-slate-500 py-1">복합지문:</span>
            {groups.map((group, idx) => {
              const colors = ['bg-pink-100 text-pink-700', 'bg-purple-100 text-purple-700', 'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];
              return (
                <div key={group.id} className={`flex items-center gap-2 px-3 py-1 rounded-lg ${colors[idx % colors.length]}`}>
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-medium">[{group.label}]</span>
                  <button
                    onClick={() => ungroupQuestions(group.id)}
                    className="hover:bg-black/10 rounded p-0.5 transition-colors"
                    title="그룹 해제"
                  >
                    <Unlink className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          {editedQuestions.map((question, index) => {
            const isSelected = selectedQuestions.has(question.number);
            const isInGroup = !!question.groupId;
            const isGroupCollapsed = question.groupId && collapsedGroups.has(question.groupId);
            const isFirstInGroup = isInGroup && (index === 0 || editedQuestions[index - 1]?.groupId !== question.groupId);
            const isLastInGroup = isInGroup && (index === editedQuestions.length - 1 || editedQuestions[index + 1]?.groupId !== question.groupId);
            
            if (isInGroup && isGroupCollapsed && !isFirstInGroup) {
              return null;
            }

            return (
              <div key={`${question.number}-${index}`}>
                {isFirstInGroup && (
                  <div 
                    className={`flex items-center gap-2 mb-2 px-4 py-2 rounded-t-xl cursor-pointer ${getGroupColor(question.groupId)}`}
                    onClick={() => question.groupId && toggleGroupCollapse(question.groupId)}
                  >
                    {collapsedGroups.has(question.groupId!) ? (
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    )}
                    <Layers className="w-4 h-4 text-slate-600" />
                    <span className="font-semibold text-slate-700">복합지문 [{question.groupLabel}]</span>
                    <span className="text-sm text-slate-500">
                      ({groups.find(g => g.id === question.groupId)?.questionNumbers.length}문항)
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        question.groupId && ungroupQuestions(question.groupId);
                      }}
                      className="ml-auto flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-100 rounded transition-colors"
                    >
                      <Unlink className="w-3 h-3" />
                      그룹 해제
                    </button>
                  </div>
                )}
                
                {(!isInGroup || !isGroupCollapsed) && (
                  <div
                    className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
                      isSelected ? 'border-pink-500 ring-2 ring-pink-500/20' : 'border-slate-200'
                    } ${getGroupColor(question.groupId)} ${isInGroup && !isFirstInGroup ? 'rounded-t-none -mt-2' : ''} ${isInGroup && !isLastInGroup ? 'rounded-b-none' : ''}`}
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleQuestionSelection(question.number)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-all ${
                            isSelected
                              ? 'bg-pink-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {question.number}
                        </button>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getQuestionTypeColor(question.type)}`}>
                          {question.type || '미분류'}
                        </span>
                        {isInGroup && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                            복합지문
                          </span>
                        )}
                        {answers[question.number] ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            정답: {answers[question.number]}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500 text-sm">
                            <XCircle className="w-4 h-4" />
                            정답 미입력
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => addQuestion(index)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="아래에 문제 추가"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => splitQuestion(index)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="문제 분리"
                        >
                          <Scissors className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteQuestion(index)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="문제 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <button
                          onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                          className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                        >
                          {expandedIndex === index ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {expandedIndex === index ? '접기' : '전체'}
                        </button>
                        <button
                          onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                            editingIndex === index
                              ? 'bg-pink-100 text-pink-700'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Edit3 className="w-4 h-4" />
                          수정
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-4">
                      {editingIndex === index ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              문제 유형
                            </label>
                            <select
                              value={question.type || ''}
                              onChange={(e) => updateQuestion(index, { type: e.target.value })}
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900 bg-white"
                            >
                              <option value="">미분류</option>
                              <option value="빈칸추론">빈칸추론</option>
                              <option value="어법">어법</option>
                              <option value="어휘">어휘</option>
                              <option value="순서배열">순서배열</option>
                              <option value="문장삽입">문장삽입</option>
                              <option value="내용일치">내용일치</option>
                              <option value="내용불일치">내용불일치</option>
                              <option value="주제">주제</option>
                              <option value="요지">요지</option>
                              <option value="제목">제목</option>
                              <option value="요약문">요약문</option>
                              <option value="무관한문장">무관한문장</option>
                              <option value="지칭추론">지칭추론</option>
                              <option value="심경/분위기">심경/분위기</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              정답 (숫자만)
                            </label>
                            <input
                              type="text"
                              value={answers[question.number] || ''}
                              onChange={(e) => updateAnswer(question.number, e.target.value)}
                              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900 bg-white"
                              placeholder="예: 3 또는 ③"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                              문제 텍스트 (OCR 오류 수정)
                            </label>
                            <textarea
                              value={question.text}
                              onChange={(e) => updateQuestion(index, { text: e.target.value })}
                              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900 bg-white resize-none text-sm font-mono"
                              rows={15}
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => setEditingIndex(null)}
                              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
                            >
                              <Save className="w-4 h-4" />
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-500">정답:</label>
                            <input
                              type="text"
                              value={answers[question.number] || ''}
                              onChange={(e) => updateAnswer(question.number, e.target.value)}
                              className="w-20 px-3 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900 bg-white text-center"
                              placeholder="?"
                            />
                          </div>
                          <pre className={`text-sm text-slate-600 whitespace-pre-wrap font-sans ${
                            expandedIndex === index ? '' : 'line-clamp-4'
                          }`}>
                            {question.text}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-between items-center sticky bottom-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200 p-4 shadow-lg">
          <div className="text-sm text-slate-600">
            총 <strong>{editedQuestions.length}</strong>개 문항 | 
            복합지문 <strong className="text-pink-600">{groups.length}</strong>개 |
            정답 입력 <strong className={answeredCount === totalCount ? 'text-green-600' : 'text-amber-600'}>{answeredCount}/{totalCount}</strong>
          </div>
          <button
            onClick={handleConfirmOcr}
            disabled={isSubmitting || editedQuestions.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/25 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                OCR 확정 및 매칭 시작
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </main>

      {showGroupDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">복합지문 그룹 만들기</h3>
            <p className="text-sm text-slate-600 mb-4">
              선택한 문제: [{Array.from(selectedQuestions).sort((a, b) => a - b).join(', ')}]
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                그룹 라벨 (예: 5-7, 41-42)
              </label>
              <input
                type="text"
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900"
                placeholder="예: 5-7"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowGroupDialog(false);
                  setNewGroupLabel('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={confirmCreateGroup}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                그룹 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
