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
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'wouter';

type StaffMember = {
  id: string;
  name: string;
  bankedHours: number;
  toolCostOwed: number;
  notes: StaffNote[];
};

type StaffNote = {
  id: string;
  type: 'banked_hours' | 'tool_cost' | 'general';
  description: string;
  amount: number;
  date: string;
};

const STORAGE_KEY = 'buildflow-staff-notes';

export default function StaffNotesSimple() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [noteForm, setNoteForm] = useState({
    type: 'general' as const,
    description: '',
    amount: '',
  });
  const { toast } = useToast();

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

  const addStaffMember = () => {
    if (!newStaffName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a staff member name",
        variant: "destructive",
      });
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
    toast({
      title: "Success",
      description: `Added ${newMember.name} to staff`,
    });
  };

  const deleteStaffMember = (id: string) => {
    const member = staff.find(s => s.id === id);
    if (confirm(`Are you sure you want to remove ${member?.name} and all their notes?`)) {
      setStaff(prev => prev.filter(s => s.id !== id));
      if (selectedStaff?.id === id) {
        setSelectedStaff(null);
      }
      toast({
        title: "Removed",
        description: "Staff member removed",
      });
    }
  };

  const addNote = () => {
    if (!selectedStaff || !noteForm.description.trim()) {
      toast({
        title: "Error", 
        description: "Please fill in all required fields",
        variant: "destructive",
      });
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
        if (noteForm.type === 'banked_hours') {
          updatedMember.bankedHours += amount;
        } else if (noteForm.type === 'tool_cost') {
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
      if (noteForm.type === 'banked_hours') {
        updated.bankedHours += amount;
      } else if (noteForm.type === 'tool_cost') {
        updated.toolCostOwed += amount;
      }
      return updated;
    });

    setNoteForm({ type: 'general', description: '', amount: '' });
    setIsAddNoteOpen(false);
    toast({
      title: "Success",
      description: "Note added successfully",
    });
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
    toast({
      title: "Success",
      description: "Note updated successfully",
    });
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

      toast({
        title: "Deleted",
        description: "Note removed",
      });
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
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard">
                <Button variant="ghost" size="sm" data-testid="button-back-admin">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  Staff Notes Manager
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Track banked hours, tool costs, and general notes for your team
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsAddStaffOpen(true)} 
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-staff"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Staff Member
            </Button>
          </div>

          {/* Staff Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {staff.map((member) => (
              <Card 
                key={member.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-200 dark:hover:border-blue-700"
                onClick={() => setSelectedStaff(member)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {member.name}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStaffMember(member.id);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      data-testid={`button-delete-staff-${member.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        Banked Hours: <span className="text-blue-600">{member.bankedHours}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">
                        Tool Cost: <span className="text-red-600">${member.toolCostOwed.toFixed(2)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-600" />
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
            <div className="text-center py-16">
              <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                No staff members yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add your first staff member to start tracking notes and hours
              </p>
              <Button 
                onClick={() => setIsAddStaffOpen(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          )}
        </div>

        {/* Add Staff Dialog */}
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="staff-name">Staff Member Name</Label>
                <Input
                  id="staff-name"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="Enter full name"
                  data-testid="input-staff-name"
                  onKeyDown={(e) => e.key === 'Enter' && addStaffMember()}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddStaffOpen(false);
                    setNewStaffName('');
                  }}
                  data-testid="button-cancel-staff"
                >
                  Cancel
                </Button>
                <Button onClick={addStaffMember} data-testid="button-save-staff">
                  Add Staff Member
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
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedStaff(null)}
              data-testid="button-back-staff-list"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Staff List
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedStaff.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Staff member details and notes
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsAddNoteOpen(true)}
            className="bg-green-600 hover:bg-green-700"
            data-testid="button-add-note"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Banked Hours</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedStaff.bankedHours}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total accumulated</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tool Costs</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                ${selectedStaff.toolCostOwed.toFixed(2)}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Amount owed</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-gray-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Total Notes</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {selectedStaff.notes.length}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">All entries</p>
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
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
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
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(note.type)}
                          <Badge className={getTypeBadgeColor(note.type)}>
                            {formatTypeName(note.type)}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {note.description}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(note.date), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        {note.amount !== 0 && (
                          <div className="text-right">
                            <div className={`font-semibold ${
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
                      <div className="flex gap-1 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditNote(note)}
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNote(note.id)}
                          className="text-red-500 hover:text-red-700"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Note' : 'Add Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-type">Note Type</Label>
              <Select 
                value={noteForm.type} 
                onValueChange={(value: 'banked_hours' | 'tool_cost' | 'general') => 
                  setNoteForm(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger data-testid="select-note-type">
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
              <Label htmlFor="note-description">Description</Label>
              <Textarea
                id="note-description"
                value={noteForm.description}
                onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter note description..."
                rows={3}
                data-testid="textarea-description"
              />
            </div>

            <div>
              <Label htmlFor="note-amount">
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
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Use positive numbers to add, negative to subtract
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={resetNoteForm}
                data-testid="button-cancel-note"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={editingNote ? updateNote : addNote}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-save-note"
              >
                <Save className="h-4 w-4 mr-2" />
                {editingNote ? 'Update' : 'Add'} Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}