'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface DppsConfig {
    reportingCurrency: string;
    showSideBySideAmounts: boolean;
}

const ConfigContext = createContext<DppsConfig>({
    reportingCurrency: 'USD',
    showSideBySideAmounts: false,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
    const { data } = useQuery({
        queryKey: ['global-config'],
        queryFn: async () => {
            const res = await fetch('/api/config');
            if (!res.ok) throw new Error('Failed to fetch config');
            return res.json();
        },
        staleTime: 60000, // 1 minute
    });

    const value = {
        reportingCurrency: data?.reportingCurrency || 'USD',
        showSideBySideAmounts: data?.showSideBySideAmounts || false,
    };

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

export const useConfig = () => useContext(ConfigContext);
