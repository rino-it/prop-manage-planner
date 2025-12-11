import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, LogIn, UserPlus, Phone, User } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // NUOVI CAMPI OBBLIGATORI
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (!error) navigate('/');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Passiamo tutti i dati alla nuova funzione signUp
    await signUp(email, password, firstName, lastName, phone);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg mr-3">
             <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Prop Manager</h1>
        </div>

        <Card className="shadow-xl border-slate-200">
          <CardHeader className="text-center">
            <CardTitle>Area Riservata Staff</CardTitle>
            <CardDescription>
              Gestione immobiliare professionale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">
                  <LogIn className="w-4 h-4 mr-2" /> Accedi
                </TabsTrigger>
                <TabsTrigger value="signup">
                  <UserPlus className="w-4 h-4 mr-2" /> Registrati
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                    {loading ? 'Accesso...' : 'Entra'}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Nome *</Label>
                        <div className="relative">
                            <User className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"/>
                            <Input className="pl-9" placeholder="Mario" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Cognome *</Label>
                        <Input placeholder="Rossi" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Telefono *</Label>
                    <div className="relative">
                        <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"/>
                        <Input className="pl-9" placeholder="+39 333..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="nome@azienda.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input type="password" placeholder="Min. 6 caratteri" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 mt-2" disabled={loading}>
                    {loading ? 'Registrazione...' : 'Crea Account Staff'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;