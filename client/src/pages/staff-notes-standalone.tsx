import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Edit2, Trash2, DollarSign, Clock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'wouter';

type StaffNote = {
  id: string;
  noteType: 'banked_hours' | 'tool_bills' | 'general';
  title: string;
  content: string;
  amount?: string;
  hours?: string;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
};

// Standalone form validation schema
const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  noteType: z.enum(['banked_hours', 'tool_bills', 'general']),
  content: z.string().min(1, "Content is required"), 
  employeeId: z.string().min(1, "Employee is required"),
  amount: z.string().optional(),
  hours: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function StaffNotes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      noteType: 'general',
      content: '',
      employeeId: '',
      amount: '',
      hours: '',
    },
  });

  // Fetch staff notes
  const { data: staffNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['/api/staff-notes'],
  });

  // Fetch employees for dropdown
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['/api/employees'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest('/api/staff-notes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Staff note created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create staff note",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      await apiRequest(`/api/staff-notes/${editingNote?.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setIsDialogOpen(false);
      setEditingNote(null);
      form.reset();
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
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/staff-notes/${id}`, {
        method: 'DELETE',
      });
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
    },
  });

  const handleSubmit = (data: FormData) => {
    if (editingNote) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (note: StaffNote) => {
    setEditingNote(note);
    form.reset({
      title: note.title,
      noteType: note.noteType,
      content: note.content,
      employeeId: note.employee?.id || '',
      amount: note.amount || '',
      hours: note.hours || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this staff note?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleNewNote = () => {
    setEditingNote(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'banked_hours': return <Clock className="h-4 w-4" />;
      case 'tool_bills': return <DollarSign className="h-4 w-4" />;
      default: return null;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'tool_bills': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const formatTypeName = (type: string) => {
    switch (type) {
      case 'banked_hours': return 'Banked Hours';
      case 'tool_bills': return 'Tool Bills';
      default: return 'General';
    }
  };

  if (notesLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading staff notes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin-dashboard">
              <Button variant="ghost" size="sm" data-testid="button-back-admin">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Staff Notes Management
            </h1>
          </div>
          <Button onClick={handleNewNote} data-testid="button-add-note">
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Notes Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {staffNotes.map((note: StaffNote) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(note.noteType)}
                    <Badge className={getTypeBadgeColor(note.noteType)}>
                      {formatTypeName(note.noteType)}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(note)}
                      data-testid={`button-edit-${note.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(note.id)}
                      data-testid={`button-delete-${note.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {note.title}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Employee: {note.employee ? `${note.employee.firstName} ${note.employee.lastName}` : 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {note.content}
                  </p>
                  {note.amount && (
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Amount: ${note.amount}
                    </p>
                  )}
                  {note.hours && (
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      Hours: {note.hours}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Created: {format(new Date(note.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {staffNotes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400">
              No staff notes found. Click "Add Note" to create the first one.
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? 'Edit Staff Note' : 'Add Staff Note'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="noteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-note-type">
                          <SelectValue placeholder="Select note type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="banked_hours">Banked Hours</SelectItem>
                        <SelectItem value="tool_bills">Tool Bills</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee: Employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.firstName} {employee.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        rows={3}
                        data-testid="textarea-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount ($)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          step="0.25"
                          placeholder="0.00"
                          data-testid="input-hours"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}