'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { X, Plus, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    maxTags?: number;
    placeholder?: string;
    disabled?: boolean;
    isPro?: boolean;
    onProRequired?: () => void;
}

const PRESET_TAGS = [
    'Urgente',
    'Alta prioridad',
    'Negociando',
    'Congelado',
    'Tasa alta',
    'Gastos médicos',
    'Educación',
    'Hogar',
    'Tarjeta',
    'Préstamo',
];

export function TagInput({
    tags,
    onChange,
    maxTags = 5,
    placeholder = 'Agregar etiqueta...',
    disabled = false,
    isPro = false,
    onProRequired,
}: TagInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [showPresets, setShowPresets] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleAddTag = (tag: string) => {
        if (!isPro && onProRequired) {
            onProRequired();
            return;
        }

        const trimmedTag = tag.trim();
        if (
            trimmedTag &&
            !tags.includes(trimmedTag) &&
            tags.length < maxTags
        ) {
            onChange([...tags, trimmedTag]);
            setInputValue('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        if (!isPro && onProRequired) {
            onProRequired();
            return;
        }
        onChange(tags.filter((tag) => tag !== tagToRemove));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            handleRemoveTag(tags[tags.length - 1]);
        }
    };

    const availablePresets = PRESET_TAGS.filter((preset) => !tags.includes(preset));

    return (
        <div className="space-y-2">
            {/* Current tags */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="secondary"
                            className="pl-2 pr-1 py-0.5 text-xs"
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                disabled={disabled}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="relative">
                <div className="flex gap-2">
                    <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={!isPro ? '🔒 Etiquetas PRO' : placeholder}
                        disabled={disabled || !isPro}
                        className="flex-1"
                        onFocus={() => setShowPresets(true)}
                        onBlur={() => setTimeout(() => setShowPresets(false), 200)}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            if (!isPro && onProRequired) {
                                onProRequired();
                                return;
                            }
                            handleAddTag(inputValue);
                        }}
                        disabled={disabled || !inputValue.trim() || tags.length >= maxTags}
                    >
                        {!isPro ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>

                {/* Presets dropdown */}
                {showPresets && isPro && availablePresets.length > 0 && tags.length < maxTags && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-popover border rounded-lg shadow-lg z-10">
                        <p className="text-xs text-muted-foreground mb-2">Sugerencias:</p>
                        <div className="flex flex-wrap gap-1">
                            {availablePresets.slice(0, 6).map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => handleAddTag(preset)}
                                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted-foreground/20 transition-colors"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Helper text */}
            {isPro && tags.length >= maxTags && (
                <p className="text-xs text-muted-foreground">
                    Máximo {maxTags} etiquetas
                </p>
            )}
        </div>
    );
}
