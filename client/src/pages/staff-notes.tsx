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
// Using local schema due to import issue
// import { insertStaffNoteSchema } from '@shared/schema';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Edit2, Trash2, DollarSign, Clock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Link } from 'wouter';

type StaffNote = {
  id: string;
  noteType: 'banked_hours' | 'tool_bills' | 'general';
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

// Temporary schema until import issue is fixed
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      noteType: 'banked_hours',
      content: '',
      amount: '',
      hours: '',
      employeeId: '',
    },
  });

  const { data: staffNotes = [] } = useQuery<StaffNote[]>({
    queryKey: ['/api/staff-notes'],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('/api/staff-notes', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Staff note created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create staff note',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<FormData> }) => {
      return apiRequest(`/api/staff-notes/${data.id}`, 'PATCH', data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      setIsDialogOpen(false);
      setEditingNote(null);
      form.reset();
      toast({
        title: 'Success',
        description: 'Staff note updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update staff note',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/staff-notes/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff-notes'] });
      toast({
        title: 'Success',
        description: 'Staff note deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete staff note',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: FormData) => {
    if (editingNote) {
      updateMutation.mutate({
        id: editingNote.id,
        updates: data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (note: StaffNote) => {
    setEditingNote(note);
    form.reset({
      title: '',
      noteType: note.noteType,
      content: note.content,
      amount: note.amount || '',
      hours: note.hours || '',
      employeeId: note.employee?.id || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this staff note?')) {
      deleteMutation.mutate(id);
    }
  };

  const openCreateDialog = () => {
    setEditingNote(null);
    form.reset({
      title: '',
      noteType: 'banked_hours',
      content: '',
      amount: '',
      hours: '',
      employeeId: '',
    });
    setIsDialogOpen(true);
  };

  const selectedType = form.watch('noteType');

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Notes</h1>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-note">
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {staffNotes.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No staff notes found</p>
              </CardContent>
            </Card>
          ) : (
            staffNotes.map((note) => (
              <Card key={note.id} className="hover:shadow-md transition-shadow" data-testid={`card-note-${note.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={note.noteType === 'banked_hours' ? 'default' : 'secondary'}>
                        {note.noteType === 'banked_hours' ? (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Banked Hours
                          </>
                        ) : note.noteType === 'tool_bills' ? (
                          <>
                            <DollarSign className="h-3 w-3 mr-1" />
                            Tool Bill
                          </>
                        ) : (
                          'General Note'
                        )}
                      </Badge>
                      {note.employee && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {note.employee.firstName} {note.employee.lastName}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(note)}
                        data-testid={`button-edit-${note.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(note.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-${note.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{note.content}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex gap-4">
                      {note.amount && (
                        <span data-testid={`text-amount-${note.id}`}>
                          Amount: ${note.amount}
                        </span>
                      )}
                      {note.hours && (
                        <span data-testid={`text-hours-${note.id}`}>
                          Hours: {note.hours}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div>Created: {format(new Date(note.createdAt), 'MMM d, yyyy')}</div>
                      {note.createdBy && (
                        <div className="text-xs">
                          by {note.createdBy.firstName} {note.createdBy.lastName}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingNote ? 'Edit Staff Note' : 'Create Staff Note'}
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
                        <Input 
                          {...field} 
                          placeholder="Enter note title..."
                          data-testid="input-title"
                        />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="banked_hours">Banked Hours</SelectItem>
                          <SelectItem value="tool_bills">Tool Bills</SelectItem>
                          <SelectItem value="general">General Note</SelectItem>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee">
                            <SelectValue placeholder="Select employee" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee) => (
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
                          placeholder="Enter detailed notes..."
                          className="min-h-[80px]"
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedType === 'tool_bills' && (
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
                )}

                {selectedType === 'banked_hours' && (
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
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
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
    </div>
  );
}