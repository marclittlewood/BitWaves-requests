import React from 'react';

export interface SearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function SearchBox({
    value,
    onChange,
    placeholder = "Search...",
    disabled = false,
}: SearchBoxProps) {
    return (
        <div className="relative">
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <svg
                className="pointer-events-none absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
            </svg>
        </div>
    );
}
