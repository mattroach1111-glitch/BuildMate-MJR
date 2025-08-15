import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Edit3, Trash2, DollarSign, Clock, User, ArrowLeft, Save, X, Calculator } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';

interface StaffMember {
  id: string;
  name: string;
  bankedHours: number;
  toolCostOwed: number;
  notes: StaffNote[];
}

interface StaffNote {
  id: string;
  type: 'banked_hours' | 'tool_cost' | 'general';
  description: string;
  amount: number;
  date: string;
}

interface NoteFormData {
  type: 'banked_hours' | 'tool_cost' | 'general';
  description: string;
  amount: string;
}

const STORAGE_KEY = 'buildflow-staff-notes';

export default function StaffNotesClean() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [noteForm, setNoteForm] = useState<NoteFormData>({
    type: 'general',
    description: '',
    amount: '',
  });
  const [toastMessage, setToastMessage] = useState<string>('');

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setStaff(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading staff data:', error);
      }
    }
  }, []);

  // Save to localStorage whenever staff changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
  }, [staff]);

  // Simple toast replacement
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const addStaffMember = () => {
    if (!newStaffName.trim()) {
      showToast('Please enter a staff member name');
      return;
    }

    const newMember: StaffMember = {
      id: Date.now().toString(),
      name: newStaffName.trim(),
      bankedHours: 0,
      toolCostOwed: 0,
      notes: [],
    };

    setStaff(prev => [...prev, newMember]);
    setNewStaffName('');
    setIsAddStaffOpen(false);
    showToast(`Added ${newMember.name} to staff`);
  };

  const deleteStaffMember = (id: string) => {
    const member = staff.find(s => s.id === id);
    if (confirm(`Are you sure you want to remove ${member?.name} and all their notes?`)) {
      setStaff(prev => prev.filter(s => s.id !== id));
      if (selectedStaff?.id === id) {
        setSelectedStaff(null);
      }
      showToast('Staff member removed');
    }
  };

  const addNote = () => {
    if (!selectedStaff || !noteForm.description.trim()) {
      showToast('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(noteForm.amount) || 0;
    const newNote: StaffNote = {
      id: Date.now().toString(),
      type: noteForm.type,
      description: noteForm.description.trim(),
      amount,
      date: new Date().toISOString(),
    };

    setStaff(prev => prev.map(member => {
      if (member.id === selectedStaff.id) {
        const updatedMember = {
          ...member,
          notes: [...member.notes, newNote],
        };

        // Update running totals
        if (newNote.type === 'banked_hours') {
          updatedMember.bankedHours += amount;
        } else if (newNote.type === 'tool_cost') {
          updatedMember.toolCostOwed += amount;
        }

        return updatedMember;
      }
      return member;
    }));

    // Update selected staff to reflect changes
    setSelectedStaff(prev => {
      if (!prev) return null;
      const updated = { ...prev, notes: [...prev.notes, newNote] };
      if (newNote.type === 'banked_hours') {
        updated.bankedHours += amount;
      } else if (newNote.type === 'tool_cost') {
        updated.toolCostOwed += amount;
      }
      return updated;
    });

    setNoteForm({ type: 'general', description: '', amount: '' });
    setIsAddNoteOpen(false);
    showToast('Note added successfully');
  };

  const updateNote = () => {
    if (!selectedStaff || !editingNote || !noteForm.description.trim()) {
      return;
    }

    const newAmount = parseFloat(noteForm.amount) || 0;
    const oldAmount = editingNote.amount;
    const amountDiff = newAmount - oldAmount;

    setStaff(prev => prev.map(member => {
      if (member.id === selectedStaff.id) {
        const updatedMember = {
          ...member,
          notes: member.notes.map(note => 
            note.id === editingNote.id 
              ? { ...note, description: noteForm.description.trim(), amount: newAmount }
              : note
          ),
        };

        // Update running totals
        if (editingNote.type === 'banked_hours') {
          updatedMember.bankedHours += amountDiff;
        } else if (editingNote.type === 'tool_cost') {
          updatedMember.toolCostOwed += amountDiff;
        }

        return updatedMember;
      }
      return member;
    }));

    setEditingNote(null);
    setNoteForm({ type: 'general', description: '', amount: '' });
    setIsAddNoteOpen(false);
    showToast('Note updated successfully');
  };

  const deleteNote = (noteId: string) => {
    if (!selectedStaff) return;

    const noteToDelete = selectedStaff.notes.find(n => n.id === noteId);
    if (!noteToDelete) return;

    if (confirm('Are you sure you want to delete this note?')) {
      setStaff(prev => prev.map(member => {
        if (member.id === selectedStaff.id) {
          const updatedMember = {
            ...member,
            notes: member.notes.filter(note => note.id !== noteId),
          };

          // Update running totals
          if (noteToDelete.type === 'banked_hours') {
            updatedMember.bankedHours -= noteToDelete.amount;
          } else if (noteToDelete.type === 'tool_cost') {
            updatedMember.toolCostOwed -= noteToDelete.amount;
          }

          return updatedMember;
        }
        return member;
      }));

      setSelectedStaff(prev => {
        if (!prev) return null;
        const updated = { ...prev, notes: prev.notes.filter(note => note.id !== noteId) };
        if (noteToDelete.type === 'banked_hours') {
          updated.bankedHours -= noteToDelete.amount;
        } else if (noteToDelete.type === 'tool_cost') {
          updated.toolCostOwed -= noteToDelete.amount;
        }
        return updated;
      });

      showToast('Note removed');
    }
  };

  const startEditNote = (note: StaffNote) => {
    setEditingNote(note);
    setNoteForm({
      type: note.type,
      description: note.description,
      amount: note.amount.toString(),
    });
    setIsAddNoteOpen(true);
  };

  const resetNoteForm = () => {
    setEditingNote(null);
    setNoteForm({ type: 'general', description: '', amount: '' });
    setIsAddNoteOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'banked_hours': return <Clock className="h-4 w-4" />;
      case 'tool_cost': return <DollarSign className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'tool_cost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatTypeName = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'Banked Hours';
      case 'tool_cost': return 'Tool Cost';
      default: return 'General';
    }
  };

  if (!selectedStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50">
            {toastMessage}
          </div>
        )}

        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back-admin" className="self-start">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Staff Notes Manager
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                  Track banked hours, tool costs, and general notes
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsAddStaffOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              data-testid="button-add-staff"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          </div>

          {/* Staff Grid */}
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((member) => (
              <Card 
                key={member.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-200 dark:hover:border-blue-700"
                onClick={() => setSelectedStaff(member)}
              >
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {member.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStaffMember(member.id);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                      data-testid={`button-delete-staff-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Hours: <span className="text-blue-600">{member.bankedHours}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Tools: <span className="text-red-600">${member.toolCostOwed.toFixed(2)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600">
                        {member.notes.length} note{member.notes.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {staff.length === 0 && (
            <div className="text-center py-12 sm:py-16 px-4">
              <User className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                No staff members yet
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                Add your first staff member to start tracking
              </p>
              <Button 
                onClick={() => setIsAddStaffOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          )}
        </div>

        {/* Add Staff Dialog */}
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="staff-name" className="text-sm font-medium">Staff Member Name</Label>
                <Input
                  id="staff-name"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Enter full name"
                  data-testid="input-staff-name"
                  onKeyDown={(e) => e.key === 'Enter' && addStaffMember()}
                  className="mt-1 h-11"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddStaffOpen(false);
                    setNewStaffName('');
                  }}
                  data-testid="button-cancel-staff"
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button onClick={addStaffMember} data-testid="button-save-staff" className="flex-1 h-11">
                  Add Staff
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Individual staff member view
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedStaff(null)}
              data-testid="button-back-staff-list"
              className="self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staff List
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedStaff.name}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Staff member details and notes
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsAddNoteOpen(true)}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            data-testid="button-add-note"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 mb-6 sm:mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Banked Hours</h3>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">
                {selectedStaff.bankedHours}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total accumulated</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Tool Costs</h3>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-red-600">
                ${selectedStaff.toolCostOwed.toFixed(2)}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Amount owed</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-500">
            <CardHeader className="pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Total Notes</h3>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-gray-700 dark:text-gray-300">
                {selectedStaff.notes.length}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">All entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Notes List */}
        <Card>
          <CardHeader>
            <CardTitle>Notes History</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedStaff.notes.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4">
                <User className="h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                  No notes yet. Add the first note to start tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedStaff.notes
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((note) => (
                    <div 
                      key={note.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3 sm:gap-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getTypeIcon(note.type)}
                          <Badge className={`${getTypeBadgeColor(note.type)} text-xs`}>
                            {formatTypeName(note.type)}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-words">
                            {note.description}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(note.date), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        {note.amount !== 0 && (
                          <div className="text-left sm:text-right flex-shrink-0">
                            <div className={`font-semibold text-sm sm:text-base ${
                              note.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {note.type === 'banked_hours' 
                                ? `${note.amount > 0 ? '+' : ''}${note.amount} hrs`
                                : `${note.amount > 0 ? '+' : ''}$${Math.abs(note.amount).toFixed(2)}`
                              }
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditNote(note)}
                          data-testid={`button-edit-note-${note.id}`}
                          className="h-8 w-8 p-0"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNote(note.id)}
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Note Dialog */}
      <Dialog open={isAddNoteOpen} onOpenChange={resetNoteForm}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingNote ? 'Edit Note' : 'Add Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-type" className="text-sm font-medium">Note Type</Label>
              <Select 
                value={noteForm.type} 
                onValueChange={(value: 'banked_hours' | 'tool_cost' | 'general') => 
                  setNoteForm(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger data-testid="select-note-type" className="mt-1 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banked_hours">Banked Hours</SelectItem>
                  <SelectItem value="tool_cost">Tool Cost</SelectItem>
                  <SelectItem value="general">General Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="note-description"
                value={noteForm.description}
                onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter note description..."
                rows={3}
                data-testid="textarea-description"
                className="mt-1 resize-none"
              />
            </div>

            <div>
              <Label htmlFor="note-amount" className="text-sm font-medium">
                {noteForm.type === 'banked_hours' ? 'Hours (+/-)' : 'Amount (+/-)'}
              </Label>
              <Input
                id="note-amount"
                type="number"
                step={noteForm.type === 'banked_hours' ? '0.25' : '0.01'}
                value={noteForm.amount}
                onChange={(e) => setNoteForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder={noteForm.type === 'banked_hours' ? '8.0' : '50.00'}
                data-testid="input-amount"
                className="mt-1 h-11"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Use positive numbers to add, negative to subtract
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={resetNoteForm}
                data-testid="button-cancel-note"
                className="flex-1 h-11"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={editingNote ? updateNote : addNote}
                className="bg-green-600 hover:bg-green-700 flex-1 h-11"
                data-testid="button-save-note"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingNote ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}