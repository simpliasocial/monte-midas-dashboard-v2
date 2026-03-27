import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

import { Calendar, Clock, MapPin, Phone, Radio, User } from "lucide-react";

export interface Appointment {
    id: number;
    nombre: string;
    celular: string;
    agencia: string;
    fecha: string;
    hora: string;
    canal?: string;
    status: string;
}

interface RecentAppointmentsProps {
    appointments?: Appointment[];
}

export function RecentAppointments({ appointments = [] }: RecentAppointmentsProps) {
    // Use props if available, otherwise fallback to empty or loading state
    // Actually, let's just use the props. The parent will handle loading or passing default.
    const displayAppointments = appointments.length > 0 ? appointments : [];

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Cliente</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead>Canal</TableHead>
                        <TableHead>Agencia</TableHead>
                        <TableHead>Fecha y Hora</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {displayAppointments.map((appointment) => (
                        <TableRow key={appointment.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {appointment.nombre}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {appointment.celular}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Radio className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-medium">{appointment.canal || '—'}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    {appointment.agencia}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                        {appointment.fecha}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {appointment.hora}
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
