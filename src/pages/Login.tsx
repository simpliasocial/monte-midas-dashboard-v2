import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, User } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // El usuario solicitó que el usuario y contraseña sean 'montemidas'
            // Intentamos validación vía RPC primero para mantener la conexión con la DB
            const { data, error: rpcError } = await supabase.rpc('verify_custom_credentials', {
                p_username: username,
                p_password: password
            });

            // Si el RPC falla o no está configurado, usamos validación local para asegurar acceso según requerimiento
            if (data === true || (username === 'montemidas' && password === 'montemidas')) {
                localStorage.setItem('isAuthenticated', 'true');
                navigate('/');
                toast.success('Sesión iniciada correctamente');
            } else {
                setError('Credenciales incorrectas');
            }
        } catch (err: any) {
            console.error('Login error:', err);

            // Fallback de emergencia si el RPC falla por completo (ej. no existe la función)
            if (username === 'montemidas' && password === 'montemidas') {
                localStorage.setItem('isAuthenticated', 'true');
                navigate('/');
                toast.success('Sesión iniciada (Modo Local)');
            } else {
                setError(err.message || 'Error al iniciar sesión');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
            <Card className="w-full max-w-md border-slate-700 bg-slate-900/50 backdrop-blur-xl text-slate-100 shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 rounded-full bg-primary/10 ring-1 ring-primary/50 shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)]">
                            <Lock className="w-10 h-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary">Monte Midas</CardTitle>
                    <CardDescription className="text-slate-400 text-lg">
                        Dashboard de Control
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Usuario</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                <Input
                                    id="username"
                                    placeholder="Usuario"
                                    type="text"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    disabled={loading}
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="pl-10 bg-slate-800/50 border-slate-700 focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                <Input
                                    id="password"
                                    placeholder="••••••••"
                                    type="password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    disabled={loading}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 bg-slate-800/50 border-slate-700 focus:border-primary"
                                />
                            </div>
                        </div>
                        <Button className="w-full mt-6" type="submit" disabled={loading}>
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Verificando...
                                </div>
                            ) : (
                                'Ingresar al Sistema'
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
