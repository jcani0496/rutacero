'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SupportNavProps {
    showSla?: boolean;
    showOps?: boolean;
}

export function SupportNav({ showSla = true, showOps = true }: SupportNavProps) {
    const pathname = usePathname();
    const tabs = [
        { href: '/admin/support/tickets', label: 'Tickets' },
        ...(showSla ? [{ href: '/admin/support/slas', label: 'SLAs' }] : []),
        ...(showOps ? [{ href: '/admin/support/ops', label: 'Operaciones' }] : []),
    ];

    return (
        <nav className="w-fit max-w-full rounded-full border border-border/60 bg-muted/40 p-1 shadow-sm">
            <div className="flex flex-wrap gap-1">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                            )}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
