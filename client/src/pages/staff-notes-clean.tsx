import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Edit3, Trash2, DollarSign, Clock, User, ArrowLeft, Save, X, Calculator, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import jsPDF from 'jspdf';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  name: string;
  defaultHourlyRate: string;
  createdAt: string;
}

interface StaffNote {
  id: string;
  noteType: 'banked_hours' | 'tool_bills' | 'general';
  title: string;
  content: string;
  amount: string | null;
  hours: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface NoteFormData {
  noteType: 'banked_hours' | 'tool_bills' | 'general';
  title: string;
  content: string;
  amount: string;
  hours: string;
  employeeId: string;
}

export default function StaffNotesClean() {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormData>({
    noteType: 'general',
    title: '',
    content: '',
    amount: '',
    hours: '',
    employeeId: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Fetch staff notes
  const { data: staffNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['/api/staff-notes'],
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: Omit<NoteFormData, 'employeeId'> & { employeeId: string }) => {
      return apiRequest('/api/staff-notes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      toast({ title: 'Note created successfully' });
      setIsAddNoteOpen(false);
      resetNoteForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error creating note', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Update note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NoteFormData> }) => {
      return apiRequest(`/api/staff-notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      toast({ title: 'Note updated successfully' });
      setEditingNote(null);
      resetNoteForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error updating note', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/staff-notes/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      toast({ title: 'Note deleted successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error deleting note', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const resetNoteForm = () => {
    setNoteForm({
      noteType: 'general',
      title: '',
      content: '',
      amount: '',
      hours: '',
      employeeId: '',
    });
  };

  // Helper functions for calculations
  const getNotesForEmployee = (employeeId: string) => {
    return staffNotes.filter(note => note.employee?.id === employeeId);
  };

  const calculateTotals = (employeeId: string) => {
    const notes = getNotesForEmployee(employeeId);
    const bankedHours = notes
      .filter(note => note.noteType === 'banked_hours')
      .reduce((sum, note) => sum + (parseFloat(note.hours || '0')), 0);
    
    const toolCosts = notes
      .filter(note => note.noteType === 'tool_bills')
      .reduce((sum, note) => sum + (parseFloat(note.amount || '0')), 0);
    
    return { bankedHours, toolCosts };
  };

  const handleCreateNote = () => {
    if (!noteForm.title.trim() || !noteForm.employeeId) {
      toast({ 
        title: 'Missing information', 
        description: 'Please fill in all required fields',
        variant: 'destructive' 
      });
      return;
    }

    createNoteMutation.mutate({
      noteType: noteForm.noteType,
      title: noteForm.title,
      content: noteForm.content,
      amount: noteForm.amount ? parseFloat(noteForm.amount).toString() : null,
      hours: noteForm.hours ? parseFloat(noteForm.hours).toString() : null,
      employeeId: noteForm.employeeId,
    });
  };

  const handleUpdateNote = () => {
    if (!editingNote) return;
    
    updateNoteMutation.mutate({
      id: editingNote.id,
      data: {
        noteType: noteForm.noteType,
        title: noteForm.title,
        content: noteForm.content,
        amount: noteForm.amount ? parseFloat(noteForm.amount).toString() : null,
        hours: noteForm.hours ? parseFloat(noteForm.hours).toString() : null,
      },
    });
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm('Are you sure you want to delete this note?')) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const openEditNote = (note: StaffNote) => {
    setEditingNote(note);
    setNoteForm({
      noteType: note.noteType,
      title: note.title,
      content: note.content,
      amount: note.amount || '',
      hours: note.hours || '',
      employeeId: note.employee.id,
    });
    setIsAddNoteOpen(true);
  };

  const generateIndividualPDF = (employee: Employee) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = 30;

    const employeeNotes = getNotesForEmployee(employee.id);
    const totals = calculateTotals(employee.id);

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Staff Notes - ${employee.name}`, pageWidth / 2, yPosition, { align: 'center' });
    
    // Date
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 20;

    // Staff member header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${employee.name}`, margin, yPosition);
    yPosition += 8;

    // Summary info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const hourlyRate = parseFloat(employee.defaultHourlyRate);
    const summaryText = `Banked Hours: ${totals.bankedHours} | Rate: $${hourlyRate}/hr | Value: $${(totals.bankedHours * hourlyRate).toFixed(2)} | Tools Owed: $${totals.toolCosts.toFixed(2)}`;
    doc.text(summaryText, margin, yPosition);
    yPosition += 15;

    if (employeeNotes.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('No notes recorded', margin + 5, yPosition);
      yPosition += 10;
    } else {
      // Notes header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', margin + 5, yPosition);
      yPosition += 8;

      // Sort notes by date (newest first)
      const sortedNotes = [...employeeNotes].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      sortedNotes.forEach((note, noteIndex) => {
        // Check if we need a new page for notes
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const typeText = note.noteType === 'banked_hours' ? 'Banked Hours' :
                        note.noteType === 'tool_bills' ? 'Tool Bills' : 'General';
        
        const amountText = note.noteType === 'banked_hours' 
          ? `${note.hours || 0} hrs`
          : `$${parseFloat(note.amount || '0').toFixed(2)}`;

        // Note line
        const noteText = `${format(new Date(note.createdAt), 'MMM dd, yyyy')} | ${typeText} | ${amountText} | ${note.title}`;
        
        // Split long text if needed
        const textLines = doc.splitTextToSize(noteText, pageWidth - margin * 2 - 10);
        textLines.forEach((line: string) => {
          doc.text(line, margin + 10, yPosition);
          yPosition += 5;
        });
        
        // Add content if available
        if (note.content) {
          const contentLines = doc.splitTextToSize(`   ${note.content}`, pageWidth - margin * 2 - 20);
          contentLines.forEach((line: string) => {
            doc.text(line, margin + 15, yPosition);
            yPosition += 4;
          });
        }
        yPosition += 3;
      });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      doc.text(`BuildFlow Pro - ${employee.name} Notes`, margin, doc.internal.pageSize.height - 10);
    }

    // Save the PDF
    const fileName = `staff-notes-${employee.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    toast({ title: `PDF generated for ${employee.name}` });
  };

  if (employeesLoading || notesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading staff notes...</p>
        </div>
      </div>
    );
  }

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
        } else if (newNote.type === 'rdo_hours') {
          updatedMember.rdoHours += amount;
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
      } else if (newNote.type === 'rdo_hours') {
        updated.rdoHours += amount;
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
        } else if (editingNote.type === 'rdo_hours') {
          updatedMember.rdoHours += amountDiff;
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
          } else if (noteToDelete.type === 'rdo_hours') {
            updatedMember.rdoHours -= noteToDelete.amount;
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
        } else if (noteToDelete.type === 'rdo_hours') {
          updated.rdoHours -= noteToDelete.amount;
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
      case 'rdo_hours': return <Clock className="h-4 w-4" />;
      case 'tool_cost': return <DollarSign className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rdo_hours': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'tool_cost': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatTypeName = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'Banked Hours';
      case 'rdo_hours': return 'RDO Hours';
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
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="button-back-admin" className="self-start">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Admin
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
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={generatePDF} 
                variant="outline"
                className="flex-1 sm:flex-none"
                data-testid="button-export-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                onClick={() => setIsAddStaffOpen(true)} 
                className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                data-testid="button-add-staff"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </div>
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateIndividualPDF(member);
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1"
                        data-testid={`button-export-staff-pdf-${member.id}`}
                        title={`Export PDF for ${member.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
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
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Banked: <span className="text-blue-600">{member.bankedHours} hrs</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        RDO: <span className="text-purple-600">{member.rdoHours} hrs</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-medium">
                        Value: <span className="text-green-600">${(member.bankedHours * member.hourlyRate).toFixed(2)}</span>
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
                  className="mt-1 h-11"
                />
              </div>
              <div>
                <Label htmlFor="staff-rate" className="text-sm font-medium">Hourly Rate ($)</Label>
                <Input
                  id="staff-rate"
                  type="number"
                  step="0.01"
                  value={newStaffRate}
                  onChange={(e) => setNewStaffRate(e.target.value)}
                  placeholder="45.00"
                  data-testid="input-staff-rate"
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
                    setNewStaffRate('');
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

        {/* Edit Staff Rate Dialog */}
        <Dialog open={!!editingStaff} onOpenChange={() => { setEditingStaff(null); setEditStaffRate(''); }}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">Edit Hourly Rate - {editingStaff?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-staff-rate" className="text-sm font-medium">Hourly Rate ($)</Label>
                <Input
                  id="edit-staff-rate"
                  type="number"
                  step="0.01"
                  value={editStaffRate}
                  onChange={(e) => setEditStaffRate(e.target.value)}
                  placeholder="45.00"
                  data-testid="input-edit-staff-rate"
                  onKeyDown={(e) => e.key === 'Enter' && updateStaffRate()}
                  className="mt-1 h-11"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingStaff(null);
                    setEditStaffRate('');
                  }}
                  data-testid="button-cancel-edit-rate"
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button onClick={updateStaffRate} data-testid="button-save-edit-rate" className="flex-1 h-11">
                  Update Rate
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
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6 sm:mb-8">
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
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Overtime hours</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">RDO Hours</h3>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-purple-600">
                {selectedStaff.rdoHours}
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Rostered days off</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Hours Value</h3>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                ${(selectedStaff.bankedHours * selectedStaff.hourlyRate).toFixed(2)}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">@ ${selectedStaff.hourlyRate}/hr</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditStaffRate(selectedStaff)}
                  className="h-6 px-2 text-xs"
                  data-testid="button-edit-rate"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
              </div>
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
                              {note.type === 'banked_hours' || note.type === 'rdo_hours'
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
                onValueChange={(value: 'banked_hours' | 'tool_cost' | 'rdo_hours' | 'general') => 
                  setNoteForm(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger data-testid="select-note-type" className="mt-1 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banked_hours">Banked Hours</SelectItem>
                  <SelectItem value="rdo_hours">RDO Hours</SelectItem>
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
                {noteForm.type === 'banked_hours' || noteForm.type === 'rdo_hours' ? 'Hours (+/-)' : 'Amount (+/-)'}
              </Label>
              <Input
                id="note-amount"
                type="number"
                step={noteForm.type === 'banked_hours' || noteForm.type === 'rdo_hours' ? '0.25' : '0.01'}
                value={noteForm.amount}
                onChange={(e) => setNoteForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder={noteForm.type === 'banked_hours' || noteForm.type === 'rdo_hours' ? '8.0' : '50.00'}
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