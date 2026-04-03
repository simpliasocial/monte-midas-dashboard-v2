import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, MessageSquare, Download } from 'lucide-react';
import Index from '@/pages/Index';
import ChatwootPage from '@/pages/ChatwootPage';
import ReportsPage from '@/pages/ReportsPage';

const DashboardLayout = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Monte Midas Dashboard</h1>
                        <p className="text-muted-foreground mt-1">Vista general del rendimiento y métricas clave</p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            localStorage.removeItem('isAuthenticated');
                            window.location.href = '/login';
                        }}
                        className="flex items-center gap-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </div>

                <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full max-w-2xl grid-cols-3">
                        <TabsTrigger value="dashboard" className="flex items-center gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="chats" className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Chats Chatwoot
                        </TabsTrigger>
                        <TabsTrigger value="reportes" className="flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Reportes CSV
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="space-y-6">
                        <Index />
                    </TabsContent>

                    <TabsContent value="chats" className="space-y-6">
                        <ChatwootPage />
                    </TabsContent>

                    <TabsContent value="reportes" className="space-y-6">
                        <ReportsPage />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default DashboardLayout;
