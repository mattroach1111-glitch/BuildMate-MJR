import { useState } from 'react';
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

export default function StaffNotesServer() {
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
    if (!staffNotes || !Array.isArray(staffNotes)) return [];
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

  if (!selectedEmployee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
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
          </div>

          {/* Employee Grid */}
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => {
              const totals = calculateTotals(employee.id);
              const hourlyRate = parseFloat(employee.defaultHourlyRate);
              const notes = getNotesForEmployee(employee.id);
              
              return (
                <Card 
                  key={employee.id} 
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-blue-200 dark:hover:border-blue-700"
                  onClick={() => setSelectedEmployee(employee)}
                  data-testid={`employee-card-${employee.id}`}
                >
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {employee.name}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateIndividualPDF(employee);
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1"
                        data-testid={`button-export-pdf-${employee.id}`}
                        title={`Export PDF for ${employee.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          Banked: <span className="text-blue-600">{totals.bankedHours} hrs</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          Value: <span className="text-green-600">${(totals.bankedHours * hourlyRate).toFixed(2)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-red-600 flex-shrink-0" />
                        <span className="text-sm font-medium">
                          Tools: <span className="text-red-600">${totals.toolCosts.toFixed(2)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
                        <span className="text-sm text-gray-600">
                          {notes.length} note{notes.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {employees.length === 0 && (
            <div className="text-center py-12 sm:py-16 px-4">
              <User className="h-12 w-12 sm:h-16 sm:w-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                No employees found
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                Staff members need to be added through the Employee Management section first
              </p>
              <Link href="/admin">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Employee Management
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Employee detail view with notes
  const employeeNotes = getNotesForEmployee(selectedEmployee.id);
  const totals = calculateTotals(selectedEmployee.id);
  const hourlyRate = parseFloat(selectedEmployee.defaultHourlyRate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSelectedEmployee(null)}
              data-testid="button-back-employees"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Employees
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {selectedEmployee.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Staff Notes & Tracking
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => generateIndividualPDF(selectedEmployee)}
              variant="outline"
              size="sm"
              data-testid="button-export-employee-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              onClick={() => {
                setNoteForm({ ...noteForm, employeeId: selectedEmployee.id });
                setIsAddNoteOpen(true);
              }}
              data-testid="button-add-note"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Banked Hours</p>
                  <p className="text-xl font-bold text-blue-600">{totals.bankedHours}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Value</p>
                  <p className="text-xl font-bold text-green-600">${(totals.bankedHours * hourlyRate).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Tool Costs</p>
                  <p className="text-xl font-bold text-red-600">${totals.toolCosts.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes List */}
        <Card>
          <CardHeader>
            <CardTitle>Notes History</CardTitle>
          </CardHeader>
          <CardContent>
            {employeeNotes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No notes recorded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {employeeNotes
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((note) => (
                    <div 
                      key={note.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={
                              note.noteType === 'banked_hours' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              note.noteType === 'tool_bills' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }
                          >
                            {note.noteType === 'banked_hours' ? 'Banked Hours' :
                             note.noteType === 'tool_bills' ? 'Tool Bills' : 'General'}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {format(new Date(note.createdAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditNote(note)}
                            data-testid={`button-edit-note-${note.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-red-500 hover:text-red-700"
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-medium mb-1">{note.title}</h4>
                      {note.content && <p className="text-gray-600 text-sm mb-2">{note.content}</p>}
                      <div className="flex gap-4 text-sm">
                        {note.hours && (
                          <span className="text-blue-600">Hours: {note.hours}</span>
                        )}
                        {note.amount && (
                          <span className="text-green-600">Amount: ${parseFloat(note.amount).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Note Dialog */}
      <Dialog open={isAddNoteOpen} onOpenChange={(open) => {
        setIsAddNoteOpen(open);
        if (!open) {
          setEditingNote(null);
          resetNoteForm();
        }
      }}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Note' : 'Add Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note-type">Note Type</Label>
              <Select 
                value={noteForm.noteType} 
                onValueChange={(value: 'banked_hours' | 'tool_bills' | 'general') => 
                  setNoteForm({ ...noteForm, noteType: value })
                }
              >
                <SelectTrigger data-testid="select-note-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banked_hours">Banked Hours</SelectItem>
                  <SelectItem value="tool_bills">Tool Bills</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                placeholder="Enter note title"
                data-testid="input-note-title"
              />
            </div>

            <div>
              <Label htmlFor="note-content">Description</Label>
              <Textarea
                id="note-content"
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                placeholder="Enter note description"
                data-testid="textarea-note-content"
              />
            </div>

            {noteForm.noteType === 'banked_hours' && (
              <div>
                <Label htmlFor="note-hours">Hours</Label>
                <Input
                  id="note-hours"
                  type="number"
                  step="0.5"
                  value={noteForm.hours}
                  onChange={(e) => setNoteForm({ ...noteForm, hours: e.target.value })}
                  placeholder="0"
                  data-testid="input-note-hours"
                />
              </div>
            )}

            {(noteForm.noteType === 'tool_bills' || noteForm.noteType === 'general') && (
              <div>
                <Label htmlFor="note-amount">Amount ($)</Label>
                <Input
                  id="note-amount"
                  type="number"
                  step="0.01"
                  value={noteForm.amount}
                  onChange={(e) => setNoteForm({ ...noteForm, amount: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-note-amount"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddNoteOpen(false);
                  setEditingNote(null);
                  resetNoteForm();
                }}
                data-testid="button-cancel-note"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={editingNote ? handleUpdateNote : handleCreateNote}
                data-testid="button-save-note"
                className="flex-1"
                disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
              >
                {createNoteMutation.isPending || updateNoteMutation.isPending ? 'Saving...' : 
                 editingNote ? 'Update Note' : 'Add Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}