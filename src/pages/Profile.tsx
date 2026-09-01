import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Save, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface Option {
  id: string;
  name: string;
}

const NONE = 'none';

export default function Profile() {
  const { profile, updateProfile, changePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    department: profile?.department ?? NONE,
  });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-lookup'],
    queryFn: () => api.get<Option[]>('/departments'),
  });

  if (!profile) return <div className="p-8 text-center text-muted-foreground">Loading your profile…</div>;

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    const { error } = await updateProfile({
      full_name: formData.full_name.trim(),
      phone: formData.phone.trim() || null,
      department: formData.department === NONE ? null : formData.department,
    });
    setSavingProfile(false);
    toast(
      error
        ? { title: 'Could not save', description: error.message, variant: 'destructive' }
        : { title: 'Profile updated' },
    );
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const { error } = await changePassword(passwords.current, passwords.next);
    setSavingPassword(false);
    if (error) {
      toast({ title: 'Could not change password', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Password changed', description: 'Please sign in again with your new password.' });
    navigate('/auth', { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
              <AvatarFallback>
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 text-center">
              <p className="font-medium">{profile.full_name ?? 'Unnamed user'}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <Badge variant="secondary" className="capitalize">
                {profile.role}
              </Badge>
            </div>
            <dl className="w-full space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Branch</dt>
                <dd>{profile.branch_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Member since</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
              <CardDescription>Your role and branch can only be changed by an administrator.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile.email} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) => setFormData({ ...formData, department: value })}
                    >
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not specified</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.name}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" disabled={savingProfile}>
                  <Save className="mr-2 h-4 w-4" />
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>Changing your password signs you out of every device.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      value={passwords.next}
                      onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      value={passwords.confirm}
                      onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline" disabled={savingPassword}>
                  {savingPassword ? 'Updating…' : 'Change password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
