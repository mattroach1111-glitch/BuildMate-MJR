import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Edit3, Trash2, DollarSign, Clock, User, ArrowLeft, Save, X, Calculator, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import jsPDF from 'jspdf';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  name: string;
  defaultHourlyRate: string;
}

interface StaffNote {
  id: string;
  noteType: 'banked_hours' | 'tool_bills' | 'general';
  title: string;
  content: string;
  amount?: string;
  hours?: string;
  dueDate?: string;
  status: 'active' | 'resolved' | 'overdue';
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    name?: string;
  };
  createdBy: {
    id: string;
    firstName?: string;
    lastName?: string;
  };
}

interface StaffMemberWithNotes {
  id: string;
  name: string;
  defaultHourlyRate: string;
  notes: StaffNote[];
  totalBankedHours: number;
  totalToolCosts: number;
  totalMonetaryValue: number;
}

interface NoteFormData {
  employeeId: string;
  noteType: 'banked_hours' | 'tool_bills' | 'general';
  title: string;
  content: string;
  amount: string;
  hours: string;
  dueDate: string;
}

export default function StaffNotesClean() {
  const [selectedStaff, setSelectedStaff] = useState<StaffMemberWithNotes | null>(null);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [newRate, setNewRate] = useState('');
  const [noteForm, setNoteForm] = useState<NoteFormData>({
    employeeId: '',
    noteType: 'general',
    title: '',
    content: '',
    amount: '',
    hours: '',
    dueDate: '',
  });
  const { toast } = useToast();

  // Fetch employees
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Fetch staff notes
  const { data: staffNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['/api/staff-notes'],
  });

  // Create staff note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (noteData: Omit<NoteFormData, 'employeeId'> & { employeeId: string }) => {
      const response = await fetch('/api/staff-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: noteData.employeeId,
          noteType: noteData.noteType,
          title: noteData.title,
          content: noteData.content,
          amount: noteData.amount ? noteData.amount : null,
          hours: noteData.hours ? noteData.hours : null,
          dueDate: noteData.dueDate ? noteData.dueDate : null,
          status: 'active',
        }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setIsAddNoteOpen(false);
      resetNoteForm();
      toast({
        title: "Success",
        description: "Staff note added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add staff note",
        variant: "destructive",
      });
    }
  });

  // Update staff note mutation
  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, ...noteData }: { id: string } & Partial<NoteFormData>) => {
      const response = await fetch(`/api/staff-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteData.title,
          content: noteData.content,
          amount: noteData.amount ? noteData.amount : null,
          hours: noteData.hours ? noteData.hours : null,
          dueDate: noteData.dueDate ? noteData.dueDate : null,
        }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setEditingNote(null);
      resetNoteForm();
      toast({
        title: "Success",
        description: "Staff note updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update staff note",
        variant: "destructive",
      });
    }
  });

  // Delete staff note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/staff-notes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      toast({
        title: "Success",
        description: "Staff note deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete staff note",
        variant: "destructive",
      });
    }
  });

  // Update employee hourly rate mutation
  const updateRateMutation = useMutation({
    mutationFn: async ({ employeeId, newRate }: { employeeId: string, newRate: string }) => {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultHourlyRate: newRate,
        }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEditingRate(null);
      setNewRate('');
      toast({
        title: "Success",
        description: "Hourly rate updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update hourly rate",
        variant: "destructive",
      });
    }
  });

  // Process employees with their notes and calculations
  const staffMembersWithNotes: StaffMemberWithNotes[] = (employees as Employee[]).map((employee: Employee) => {
    const employeeNotes = (staffNotes as StaffNote[]).filter((note: StaffNote) => note.employee?.id === employee.id);
    
    const totalBankedHours = employeeNotes
      .filter((note: StaffNote) => note.noteType === 'banked_hours')
      .reduce((sum: number, note: StaffNote) => sum + (parseFloat(note.hours || '0')), 0);
    
    const totalToolCosts = employeeNotes
      .filter((note: StaffNote) => note.noteType === 'tool_bills')
      .reduce((sum: number, note: StaffNote) => sum + (parseFloat(note.amount || '0')), 0);

    const hourlyRate = parseFloat(employee.defaultHourlyRate || '0');
    const totalMonetaryValue = (totalBankedHours * hourlyRate) + totalToolCosts;

    return {
      id: employee.id,
      name: employee.name,
      defaultHourlyRate: employee.defaultHourlyRate,
      notes: employeeNotes,
      totalBankedHours,
      totalToolCosts,
      totalMonetaryValue,
    };
  });

  // Helper functions
  const resetNoteForm = () => {
    setNoteForm({
      employeeId: '',
      noteType: 'general',
      title: '',
      content: '',
      amount: '',
      hours: '',
      dueDate: '',
    });
  };

  const handleEditNote = (note: StaffNote) => {
    setEditingNote(note);
    setNoteForm({
      employeeId: note.employee.id,
      noteType: note.noteType,
      title: note.title,
      content: note.content,
      amount: note.amount || '',
      hours: note.hours || '',
      dueDate: note.dueDate || '',
    });
    setIsAddNoteOpen(true);
  };

  const handleSubmitNote = () => {
    if (!noteForm.title.trim() || !noteForm.employeeId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, ...noteForm });
    } else {
      createNoteMutation.mutate(noteForm);
    }
  };

  const handleStartEditRate = (employeeId: string, currentRate: string) => {
    setEditingRate(employeeId);
    setNewRate(currentRate);
  };

  const handleSaveRate = (employeeId: string) => {
    if (!newRate.trim() || parseFloat(newRate) < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid hourly rate",
        variant: "destructive",
      });
      return;
    }

    updateRateMutation.mutate({ employeeId, newRate: newRate.trim() });
  };

  const handleCancelEditRate = () => {
    setEditingRate(null);
    setNewRate('');
  };

  const generateIndividualPDF = (staffMember: StaffMemberWithNotes) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    let yPosition = 30;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Staff Notes - ${staffMember.name}`, pageWidth / 2, yPosition, { align: 'center' });
    
    // Date
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, pageWidth / 2, yPosition, { align: 'center' });
    
    yPosition += 20;

    // Staff member header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${staffMember.name}`, margin, yPosition);
    yPosition += 8;

    // Summary info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryText = `Banked Hours: ${staffMember.totalBankedHours} | Rate: $${staffMember.defaultHourlyRate}/hr | Value: $${(staffMember.totalBankedHours * parseFloat(staffMember.defaultHourlyRate)).toFixed(2)} | Tools Owed: $${staffMember.totalToolCosts.toFixed(2)}`;
    doc.text(summaryText, margin, yPosition);
    yPosition += 15;

    if (staffMember.notes.length === 0) {
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
      const sortedNotes = [...staffMember.notes].sort((a, b) => 
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
          ? `${note.hours || '0'} hrs`
          : note.noteType === 'tool_bills' 
          ? `$${note.amount || '0'}`
          : '';

        // Note line
        const noteText = `${format(new Date(note.createdAt), 'MMM dd, yyyy')} | ${typeText} | ${amountText} | ${note.title}`;
        
        // Split long text if needed
        const textLines = doc.splitTextToSize(noteText, pageWidth - margin * 2 - 10);
        textLines.forEach((line: string) => {
          doc.text(line, margin + 10, yPosition);
          yPosition += 5;
        });
        
        // Add content if it exists
        if (note.content) {
          doc.setFont('helvetica', 'italic');
          const contentLines = doc.splitTextToSize(note.content, pageWidth - margin * 2 - 15);
          contentLines.forEach((line: string) => {
            doc.text(line, margin + 15, yPosition);
            yPosition += 4;
          });
          doc.setFont('helvetica', 'normal');
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
      doc.text(`BuildFlow Pro - ${staffMember.name} Notes`, margin, doc.internal.pageSize.height - 10);
    }

    // Save the PDF
    const fileName = `staff-notes-${staffMember.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    toast({
      title: "Success",
      description: `PDF generated for ${staffMember.name}`,
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'banked_hours': return <Clock className="h-4 w-4" />;
      case 'tool_bills': return <DollarSign className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'bg-blue-100 text-blue-800';
      case 'tool_bills': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (employeesLoading || notesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading staff notes...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show individual staff member view if one is selected
  if (selectedStaff) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setSelectedStaff(null)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Overview
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{selectedStaff.name}</h1>
                <p className="text-gray-600">Staff Notes Management</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => generateIndividualPDF(selectedStaff)}
                variant="outline"
                data-testid="button-generate-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </Button>
              <Button 
                onClick={() => {
                  setNoteForm({ ...noteForm, employeeId: selectedStaff.id });
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">Banked Hours</p>
                    <p className="text-2xl font-bold">{selectedStaff.totalBankedHours}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Hourly Rate</p>
                    {editingRate === selectedStaff.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          className="h-8 w-20 text-lg font-bold"
                          data-testid="input-hourly-rate"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveRate(selectedStaff.id)}
                          disabled={updateRateMutation.isPending}
                          data-testid="button-save-rate"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditRate}
                          data-testid="button-cancel-rate"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold">${selectedStaff.defaultHourlyRate}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEditRate(selectedStaff.id, selectedStaff.defaultHourlyRate)}
                          data-testid="button-edit-rate"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
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
                    <p className="text-2xl font-bold">${selectedStaff.totalToolCosts.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold">${selectedStaff.totalMonetaryValue.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes List */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedStaff.notes.length === 0 ? (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No notes recorded yet</p>
                  <p className="text-sm text-gray-500">Add a note to start tracking</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStaff.notes
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((note) => (
                    <div key={note.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getTypeIcon(note.noteType)}
                            <Badge className={getTypeBadgeColor(note.noteType)}>
                              {note.noteType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {format(new Date(note.createdAt), 'MMM dd, yyyy')}
                            </span>
                          </div>
                          <h4 className="font-medium mb-1">{note.title}</h4>
                          {note.content && (
                            <p className="text-gray-600 text-sm mb-2">{note.content}</p>
                          )}
                          <div className="flex gap-4 text-sm">
                            {note.hours && (
                              <span className="text-blue-600">Hours: {note.hours}</span>
                            )}
                            {note.amount && (
                              <span className="text-green-600">Amount: ${note.amount}</span>
                            )}
                            {note.dueDate && (
                              <span className="text-orange-600">Due: {format(new Date(note.dueDate), 'MMM dd, yyyy')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditNote(note)}
                            data-testid={`button-edit-note-${note.id}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this note?')) {
                                deleteNoteMutation.mutate(note.id);
                              }
                            }}
                            data-testid={`button-delete-note-${note.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main overview page
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" data-testid="button-home">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Staff Notes</h1>
              <p className="text-gray-600">Manage staff hours, tool costs, and records</p>
            </div>
          </div>
          <Button 
            onClick={() => setIsAddNoteOpen(true)}
            data-testid="button-add-note-global"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staffMembersWithNotes.map((member) => (
            <Card 
              key={member.id} 
              className="hover:shadow-lg transition-shadow"
              data-testid={`card-staff-${member.id}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span
                    className="cursor-pointer hover:text-blue-600"
                    onClick={() => setSelectedStaff(member)}
                  >
                    {member.name}
                  </span>
                  <Badge variant="outline">{member.notes.length} notes</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Banked Hours:</span>
                    <span className="font-medium">{member.totalBankedHours} hrs</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Tool Costs:</span>
                    <span className="font-medium text-red-600">${member.totalToolCosts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Value:</span>
                    <span className="font-bold text-green-600">${member.totalMonetaryValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Rate:</span>
                    {editingRate === member.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          type="number"
                          step="0.01"
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          className="h-6 w-16 text-sm"
                          data-testid={`input-rate-${member.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveRate(member.id);
                          }}
                          disabled={updateRateMutation.isPending}
                          data-testid={`button-save-rate-${member.id}`}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEditRate();
                          }}
                          data-testid={`button-cancel-rate-${member.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${member.defaultHourlyRate}/hr</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditRate(member.id, member.defaultHourlyRate);
                          }}
                          data-testid={`button-edit-rate-${member.id}`}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add/Edit Note Modal */}
        <Dialog open={isAddNoteOpen} onOpenChange={(open) => {
          if (!open) {
            setIsAddNoteOpen(false);
            setEditingNote(null);
            resetNoteForm();
          }
        }}>
          <DialogContent className="max-w-md mx-4 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingNote ? 'Edit Note' : 'Add New Note'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="employee">Staff Member</Label>
                <Select 
                  value={noteForm.employeeId} 
                  onValueChange={(value) => setNoteForm({...noteForm, employeeId: value})}
                  disabled={!!editingNote}
                >
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees as Employee[]).map((employee: Employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="noteType">Note Type</Label>
                <Select 
                  value={noteForm.noteType} 
                  onValueChange={(value) => setNoteForm({...noteForm, noteType: value as any})}
                >
                  <SelectTrigger data-testid="select-note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="banked_hours">Banked Hours</SelectItem>
                    <SelectItem value="tool_bills">Tool Bills</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({...noteForm, title: e.target.value})}
                  placeholder="Enter note title"
                  data-testid="input-title"
                />
              </div>

              <div>
                <Label htmlFor="content">Description</Label>
                <Textarea
                  id="content"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({...noteForm, content: e.target.value})}
                  placeholder="Enter note description"
                  rows={3}
                  data-testid="textarea-content"
                />
              </div>

              {noteForm.noteType === 'banked_hours' && (
                <div>
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    value={noteForm.hours}
                    onChange={(e) => setNoteForm({...noteForm, hours: e.target.value})}
                    placeholder="0.0"
                    data-testid="input-hours"
                  />
                </div>
              )}

              {noteForm.noteType === 'tool_bills' && (
                <div>
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={noteForm.amount}
                    onChange={(e) => setNoteForm({...noteForm, amount: e.target.value})}
                    placeholder="0.00"
                    data-testid="input-amount"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={noteForm.dueDate}
                  onChange={(e) => setNoteForm({...noteForm, dueDate: e.target.value})}
                  data-testid="input-due-date"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsAddNoteOpen(false);
                  setEditingNote(null);
                  resetNoteForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitNote}
                disabled={createNoteMutation.isPending || updateNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {createNoteMutation.isPending || updateNoteMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {editingNote ? 'Update Note' : 'Add Note'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}