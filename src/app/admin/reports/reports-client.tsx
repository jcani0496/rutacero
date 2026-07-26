'use client';

import { useState } from 'react';
import {
    Table as TablePhosphorIcon,
    Download,
    Users,
    CreditCard,
    CurrencyDollar,
    Crown,
    Bell,
    TrendUp,
    CircleNotch,
    CalendarBlank,
    Eye,
    CheckSquare,
    Square,
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import type { StandardReport, TableInfo, ColumnInfo } from '@/lib/actions/admin-reports';
import {
    generateStandardReport,
    getTableColumns,
    generateCustomReport,
} from '@/lib/actions/admin-reports';

interface ReportsClientProps {
    standardReports: StandardReport[];
    tables: TableInfo[];
}

interface ReportErrorState {
    title: string;
    message: string;
}

type CustomAction = 'columns' | 'preview' | 'download' | null;

// CSV conversion utility (client-side)
function convertToCSV(headers: string[], rows: string[][]): string {
    const escape = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headerLine = headers.map(escape).join(',');
    const dataLines = rows.map(row => row.map(escape).join(','));

    return [headerLine, ...dataLines].join('\n');
}

const iconMap: Record<string, React.ReactNode> = {
    Users: <Users {...ICON} className="h-5 w-5" />,
    CreditCard: <CreditCard {...ICON} className="h-5 w-5" />,
    DollarSign: <CurrencyDollar {...ICON} className="h-5 w-5" />,
    Crown: <Crown {...ICON} className="h-5 w-5" />,
    Bell: <Bell {...ICON} className="h-5 w-5" />,
    TrendingUp: <TrendUp {...ICON} className="h-5 w-5" />,
};

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }

    return fallback;
}

export function ReportsClient({ standardReports, tables }: ReportsClientProps) {
    const [isPending, setIsPending] = useState(false);
    const [loadingReport, setLoadingReport] = useState<string | null>(null);
    const [customAction, setCustomAction] = useState<CustomAction>(null);
    const [standardError, setStandardError] = useState<ReportErrorState | null>(null);
    const [customError, setCustomError] = useState<ReportErrorState | null>(null);

    // Date range for standard reports
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Custom report state
    const [selectedTable, setSelectedTable] = useState<string>('');
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

    const handleDownloadStandard = async (reportId: string) => {
        setLoadingReport(reportId);
        setStandardError(null);
        setIsPending(true);
        try {
            const data = await generateStandardReport(reportId, startDate || undefined, endDate || undefined);
            const csv = convertToCSV(data.headers, data.rows);
            downloadCSV(csv, `reporte_${reportId}_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (error) {
            const message = getErrorMessage(error, 'No se pudo generar el reporte seleccionado.');
            setStandardError({
                title: 'No pudimos generar el reporte',
                message,
            });
            toast.error('Error al generar el reporte', {
                description: message,
            });
            console.error('Error generating report:', error);
        } finally {
            setLoadingReport(null);
            setIsPending(false);
        }
    };

    const handleTableChange = async (tableName: string) => {
        setSelectedTable(tableName);
        setSelectedColumns([]);
        setPreviewData(null);
        setCustomError(null);
        setColumns([]);

        if (tableName) {
            setCustomAction('columns');
            setIsPending(true);
            try {
                const cols = await getTableColumns(tableName);
                setColumns(cols);
                // Select all columns by default
                setSelectedColumns(cols.map(c => c.name));
            } catch (error) {
                const message = getErrorMessage(error, 'No se pudieron cargar las columnas de la tabla.');
                setColumns([]);
                setSelectedColumns([]);
                setCustomError({
                    title: 'No pudimos cargar la configuración',
                    message,
                });
                toast.error('Error al cargar columnas', {
                    description: message,
                });
                console.error('Error fetching columns:', error);
            } finally {
                setCustomAction(null);
                setIsPending(false);
            }
        }
    };

    const toggleColumn = (columnName: string) => {
        setCustomError(null);
        setPreviewData(null);
        setSelectedColumns(prev =>
            prev.includes(columnName)
                ? prev.filter(c => c !== columnName)
                : [...prev, columnName]
        );
    };

    const selectAllColumns = () => {
        setCustomError(null);
        setPreviewData(null);
        setSelectedColumns(columns.map(c => c.name));
    };

    const deselectAllColumns = () => {
        setCustomError(null);
        setPreviewData(null);
        setSelectedColumns([]);
    };

    const handlePreview = async () => {
        if (!selectedTable || selectedColumns.length === 0) return;

        setCustomAction('preview');
        setCustomError(null);
        setIsPending(true);
        try {
            const dateColumn = columns.find(c =>
                c.name === 'created_at' || c.name === 'occurred_at' || c.name === 'date' || c.name === 'payment_date'
            )?.name;

            const data = await generateCustomReport({
                table: selectedTable,
                columns: selectedColumns,
                dateColumn,
                startDate: customStartDate || undefined,
                endDate: customEndDate || undefined,
                limit: 10, // Preview only 10 rows
            });
            setPreviewData(data);
        } catch (error) {
            const message = getErrorMessage(error, 'No se pudo generar la vista previa del reporte.');
            setPreviewData(null);
            setCustomError({
                title: 'No pudimos generar la vista previa',
                message,
            });
            toast.error('Error al generar la vista previa', {
                description: message,
            });
            console.error('Error generating preview:', error);
        } finally {
            setCustomAction(null);
            setIsPending(false);
        }
    };

    const handleDownloadCustom = async () => {
        if (!selectedTable || selectedColumns.length === 0) return;

        setCustomAction('download');
        setCustomError(null);
        setIsPending(true);
        try {
            const dateColumn = columns.find(c =>
                c.name === 'created_at' || c.name === 'occurred_at' || c.name === 'date' || c.name === 'payment_date'
            )?.name;

            const data = await generateCustomReport({
                table: selectedTable,
                columns: selectedColumns,
                dateColumn,
                startDate: customStartDate || undefined,
                endDate: customEndDate || undefined,
                limit: 10000, // Full export
            });
            const csv = convertToCSV(data.headers, data.rows);
            downloadCSV(csv, `reporte_custom_${selectedTable}_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (error) {
            const message = getErrorMessage(error, 'No se pudo exportar el reporte personalizado.');
            setCustomError({
                title: 'No pudimos exportar el CSV',
                message,
            });
            toast.error('Error al exportar el reporte personalizado', {
                description: message,
            });
            console.error('Error generating custom report:', error);
        } finally {
            setCustomAction(null);
            setIsPending(false);
        }
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold sm:text-3xl flex items-center gap-2">
                    <TablePhosphorIcon {...ICON} className="h-7 w-7" />
                    Reportes
                </h1>
                <p className="text-muted-foreground">
                    Genera y descarga reportes del sistema
                </p>
            </div>

            <Tabs defaultValue="standard" className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="standard">Reportes Estándar</TabsTrigger>
                    <TabsTrigger value="custom">Reporte Personalizado</TabsTrigger>
                </TabsList>

                {/* Standard Reports Tab */}
                <TabsContent value="standard" className="space-y-6">
                    {/* Date Range Filter */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <CalendarBlank {...ICON} className="h-5 w-5" />
                                Rango de Fechas
                            </CardTitle>
                            <CardDescription>
                                Opcional: Filtrar reportes por rango de fechas
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <Label htmlFor="startDate">Fecha Inicio</Label>
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value);
                                            setStandardError(null);
                                        }}
                                    />
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor="endDate">Fecha Fin</Label>
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value);
                                            setStandardError(null);
                                        }}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {standardError ? (
                        <Alert variant="destructive" aria-live="assertive">
                            <AlertTitle>{standardError.title}</AlertTitle>
                            <AlertDescription>{standardError.message}</AlertDescription>
                        </Alert>
                    ) : null}

                    {/* Reports Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {standardReports.map((report) => (
                            <Card key={report.id} className="flex flex-col">
                                <CardHeader className="flex-1">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        {iconMap[report.icon] || <TablePhosphorIcon {...ICON} className="h-5 w-5" />}
                                        {report.name}
                                    </CardTitle>
                                    <CardDescription>{report.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        className="w-full"
                                        onClick={() => handleDownloadStandard(report.id)}
                                        disabled={isPending && loadingReport === report.id}
                                    >
                                        {isPending && loadingReport === report.id ? (
                                            <>
                                                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                                                Generando...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="h-4 w-4 mr-2" />
                                                Descargar CSV
                                            </>
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* Custom Report Tab */}
                <TabsContent value="custom" className="space-y-6">
                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* Configuration */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TablePhosphorIcon {...ICON} className="h-5 w-5" />
                                    Configuración del Reporte
                                </CardTitle>
                                <CardDescription>
                                    Selecciona la tabla y columnas a incluir
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Table Selection */}
                                <div>
                                    <Label>Tabla</Label>
                                    <Select value={selectedTable} onValueChange={handleTableChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecciona una tabla..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {tables.map((table) => (
                                                <SelectItem key={table.name} value={table.name}>
                                                    <span className="font-medium">{table.label}</span>
                                                    <span className="text-muted-foreground text-xs ml-2">
                                                        ({table.description})
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Column Selection */}
                                {columns.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>Columnas ({selectedColumns.length}/{columns.length})</Label>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant="outline" onClick={selectAllColumns}>
                                                    Todas
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={deselectAllColumns}>
                                                    Ninguna
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
                                            {columns.map((col) => (
                                                <button
                                                    key={col.name}
                                                    onClick={() => toggleColumn(col.name)}
                                                    className="flex items-center gap-2 p-2 text-left text-sm hover:bg-muted rounded transition-colors"
                                                >
                                                    {selectedColumns.includes(col.name) ? (
                                                        <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                                                    ) : (
                                                        <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    )}
                                                    <span className="truncate">{col.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Date Filter */}
                                {selectedTable && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="customStartDate">Fecha Inicio</Label>
                                            <Input
                                                id="customStartDate"
                                                type="date"
                                                value={customStartDate}
                                                onChange={(e) => {
                                                    setCustomStartDate(e.target.value);
                                                    setCustomError(null);
                                                    setPreviewData(null);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="customEndDate">Fecha Fin</Label>
                                            <Input
                                                id="customEndDate"
                                                type="date"
                                                value={customEndDate}
                                                onChange={(e) => {
                                                    setCustomEndDate(e.target.value);
                                                    setCustomError(null);
                                                    setPreviewData(null);
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {customError ? (
                                    <Alert variant="destructive" aria-live="assertive">
                                        <AlertTitle>{customError.title}</AlertTitle>
                                        <AlertDescription>{customError.message}</AlertDescription>
                                    </Alert>
                                ) : null}

                                {/* Actions */}
                                {selectedTable && selectedColumns.length > 0 && (
                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            variant="outline"
                                            onClick={handlePreview}
                                            disabled={isPending}
                                            className="flex-1"
                                        >
                                            {isPending && customAction === 'preview' ? (
                                                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Eye className="h-4 w-4 mr-2" />
                                            )}
                                            Vista Previa
                                        </Button>
                                        <Button
                                            onClick={handleDownloadCustom}
                                            disabled={isPending}
                                            className="flex-1"
                                        >
                                            {isPending && customAction === 'download' ? (
                                                <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4 mr-2" />
                                            )}
                                            Descargar CSV
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="h-5 w-5" />
                                    Vista Previa
                                </CardTitle>
                                <CardDescription>
                                    Primeras 10 filas del reporte
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isPending && customAction === 'preview' ? (
                                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                                        <p>Generando vista previa...</p>
                                    </div>
                                ) : !previewData ? (
                                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                                        <p>Selecciona una tabla y columnas, luego haz clic en &quot;Vista Previa&quot;</p>
                                    </div>
                                ) : previewData.rows.length === 0 ? (
                                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                                        <p>No se encontraron datos con los filtros seleccionados</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {previewData.headers.map((header, i) => (
                                                        <TableHead key={i} className="whitespace-nowrap">
                                                            {header}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.rows.map((row, i) => (
                                                    <TableRow key={i}>
                                                        {row.map((cell, j) => (
                                                            <TableCell key={j} className="whitespace-nowrap max-w-[200px] truncate">
                                                                {cell}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Mostrando {previewData.rows.length} de hasta 10 filas
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </>
    );
}
