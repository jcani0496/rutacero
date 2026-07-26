"use client";

import {
    CircleNotch,
    DownloadSimple,
    Funnel,
    MagnifyingGlass,
    Tag
} from '@phosphor-icons/react';
import { ICON } from '@/components/icons/phosphor';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DebtsToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  filterTag: string;
  onFilterTagChange: (value: string) => void;
  uniqueTags: string[];
  onExport: () => void;
  isExporting: boolean;
  hasDebts: boolean;
}

export function DebtsToolbar({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterTag,
  onFilterTagChange,
  uniqueTags,
  onExport,
  isExporting,
  hasDebts,
}: DebtsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="relative flex-1">
        <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por acreedor..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={filterType} onValueChange={onFilterTypeChange}>
        <SelectTrigger className="w-full sm:w-48">
          <Funnel className="mr-2 size-4" />
          <SelectValue placeholder="Filtrar por tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="CREDIT_CARD">Tarjetas de Crédito</SelectItem>
          <SelectItem value="LOAN">Préstamos</SelectItem>
          <SelectItem value="INSTALLMENT">Cuotas</SelectItem>
          <SelectItem value="INFORMAL">Deudas Informales</SelectItem>
        </SelectContent>
      </Select>
      {uniqueTags.length > 0 && (
        <Select value={filterTag} onValueChange={onFilterTagChange}>
          <SelectTrigger className="w-full sm:w-40">
            <Tag className="mr-2 size-4" />
            <SelectValue placeholder="Filtrar por tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tags</SelectItem>
            {uniqueTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        variant="outline"
        onClick={onExport}
        disabled={isExporting || !hasDebts}
        className="hidden sm:flex"
      >
        {isExporting ? (
          <CircleNotch {...ICON} className="mr-2 size-4 animate-spin" />
        ) : (
          <DownloadSimple className="mr-2 size-4" />
        )}
        Exportar
      </Button>
    </div>
  );
}
