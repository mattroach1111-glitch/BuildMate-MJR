import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Settings, Clock, Calculator, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  name: string;
  defaultHourlyRate: string;
  autoHoursEnabled: boolean;
  baseAutoHours: string;
  bonusHoursPerThreshold: string;
  bonusThreshold: string;
}

interface AutoHoursConfig {
  employeeId: string;
  autoHoursEnabled: boolean;
  baseAutoHours: string;
  bonusHoursPerThreshold: string;
  bonusThreshold: string;
}

export function AutoHoursSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<AutoHoursConfig>({
    employeeId: '',
    autoHoursEnabled: false,
    baseAutoHours: '0',
    bonusHoursPerThreshold: '0',
    bonusThreshold: '3000',
  });

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    onSuccess: (data) => {
      console.log('🔍 Employees data loaded:', data?.map(emp => ({
        id: emp.id.slice(0,8),
        name: emp.name,
        autoHoursEnabled: emp.autoHoursEnabled
      })));
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: { employeeId: string; autoHoursConfig: Omit<AutoHoursConfig, 'employeeId'> }) => {
      const response = await apiRequest('PUT', `/api/employees/${data.employeeId}/auto-hours`, data.autoHoursConfig);
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Auto hours update successful:', data);
      toast({
        title: 'Auto Hours Updated',
        description: 'Automatic hours settings have been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEditingEmployee(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update automatic hours settings',
        variant: 'destructive',
      });
    },
  });

  const handleEditStart = (employee: Employee) => {
    setEditingEmployee(employee.id);
    setTempConfig({
      employeeId: employee.id,
      autoHoursEnabled: employee.autoHoursEnabled,
      baseAutoHours: employee.baseAutoHours || '0',
      bonusHoursPerThreshold: employee.bonusHoursPerThreshold || '0',
      bonusThreshold: employee.bonusThreshold || '3000',
    });
  };

  const handleSave = () => {
    if (!editingEmployee) return;

    console.log('💾 Saving auto hours config:', tempConfig);
    updateEmployeeMutation.mutate({
      employeeId: editingEmployee,
      autoHoursConfig: {
        autoHoursEnabled: tempConfig.autoHoursEnabled,
        baseAutoHours: tempConfig.baseAutoHours,
        bonusHoursPerThreshold: tempConfig.bonusHoursPerThreshold,
        bonusThreshold: tempConfig.bonusThreshold,
      }
    });
  };

  const handleCancel = () => {
    setEditingEmployee(null);
    setTempConfig({
      employeeId: '',
      autoHoursEnabled: false,
      baseAutoHours: '0',
      bonusHoursPerThreshold: '0',
      bonusThreshold: '3000',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Users className="h-8 w-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="auto-hours-settings">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Automatic Hours Settings</h2>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">How Automatic Hours Work:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>When Enabled:</strong> Hours are automatically calculated and applied when job costs change</li>
              <li><strong>When Disabled:</strong> No new automatic hours are applied, but existing hours remain in job sheets</li>
              <li><strong>Base Hours:</strong> Added to every job sheet when auto hours are applied</li>
              <li><strong>Bonus Hours:</strong> Additional hours based on total job cost (materials + labor + everything)</li>
              <li><strong>Example:</strong> Matt has 2 base hours + 1 bonus per $1k. A $15k job = 2 + (15 × 1) = 17 total hours</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {employees?.map((employee) => {
          const isEditing = editingEmployee === employee.id;
          const config = isEditing ? tempConfig : {
            autoHoursEnabled: employee.autoHoursEnabled,
            baseAutoHours: employee.baseAutoHours || '0',
            bonusHoursPerThreshold: employee.bonusHoursPerThreshold || '0',
            bonusThreshold: employee.bonusThreshold || '3000',
          };

          return (
            <Card key={employee.id} className={isEditing ? 'ring-2 ring-blue-500' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{employee.name}</CardTitle>
                    <CardDescription>
                      Rate varies per job sheet
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.autoHoursEnabled}
                      onCheckedChange={(checked) => {
                        if (!isEditing) {
                          handleEditStart(employee);
                        }
                        setTempConfig(prev => ({ ...prev, autoHoursEnabled: checked }));
                      }}
                      data-testid={`switch-auto-hours-${employee.id}`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {config.autoHoursEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              {config.autoHoursEnabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`base-hours-${employee.id}`} className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Base Hours per Job
                      </Label>
                      <Input
                        id={`base-hours-${employee.id}`}
                        type="number"
                        step="0.1"
                        min="0"
                        value={config.baseAutoHours}
                        onChange={(e) => {
                          if (isEditing) {
                            setTempConfig(prev => ({ ...prev, baseAutoHours: e.target.value }));
                          } else {
                            handleEditStart(employee);
                            setTempConfig(prev => ({ ...prev, baseAutoHours: e.target.value }));
                          }
                        }}
                        placeholder="1.0"
                        data-testid={`input-base-hours-${employee.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Hours added to every job sheet
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor={`bonus-hours-${employee.id}`} className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Bonus Hours per Threshold
                      </Label>
                      <Input
                        id={`bonus-hours-${employee.id}`}
                        type="number"
                        step="0.1"
                        min="0"
                        value={config.bonusHoursPerThreshold}
                        onChange={(e) => {
                          if (isEditing) {
                            setTempConfig(prev => ({ ...prev, bonusHoursPerThreshold: e.target.value }));
                          } else {
                            handleEditStart(employee);
                            setTempConfig(prev => ({ ...prev, bonusHoursPerThreshold: e.target.value }));
                          }
                        }}
                        placeholder="1.0"
                        data-testid={`input-bonus-hours-${employee.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Additional hours per threshold
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`bonus-threshold-${employee.id}`} className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Bonus Threshold ($)
                      </Label>
                      <Input
                        id={`bonus-threshold-${employee.id}`}
                        type="number"
                        step="100"
                        min="0"
                        value={config.bonusThreshold}
                        onChange={(e) => {
                          if (isEditing) {
                            setTempConfig(prev => ({ ...prev, bonusThreshold: e.target.value }));
                          } else {
                            handleEditStart(employee);
                            setTempConfig(prev => ({ ...prev, bonusThreshold: e.target.value }));
                          }
                        }}
                        placeholder="3000"
                        data-testid={`input-bonus-threshold-${employee.id}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Dollar amount that triggers bonus hours
                      </p>
                    </div>
                  </div>

                  {/* Preview calculation */}
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Preview Examples:</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {(() => {
                        const threshold = parseFloat(config.bonusThreshold || '3000');
                        const baseHours = parseFloat(config.baseAutoHours || '0');
                        const bonusHours = parseFloat(config.bonusHoursPerThreshold || '0');
                        
                        return (
                          <>
                            <p>• ${threshold.toLocaleString()} job = {baseHours + bonusHours} hours</p>
                            <p>• ${(threshold * 2).toLocaleString()} job = {baseHours + (2 * bonusHours)} hours</p>
                            <p>• ${(threshold * 3).toLocaleString()} job = {baseHours + (3 * bonusHours)} hours</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={handleSave} 
                        size="sm" 
                        disabled={updateEmployeeMutation.isPending}
                        data-testid={`button-save-${employee.id}`}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateEmployeeMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleCancel} 
                        size="sm"
                        data-testid={`button-cancel-${employee.id}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {!employees?.length && (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Employees Found</h3>
            <p className="text-muted-foreground">
              Add employees first to configure automatic hours settings.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}