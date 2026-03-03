import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    fullWidth?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', fullWidth = false }) => {
    const cardClasses = `
        bg-slate-900/60 backdrop-blur-2xl border border-white/10 
        rounded-2xl p-5 md:p-6 shadow-2xl transition-all duration-300 
        hover:border-indigo-500/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]
        ${fullWidth ? 'col-span-1 lg:col-span-2' : ''}
        ${className}
    `;

    return (
        <div className={cardClasses}>
            {children}
        </div>
    );
};

export const CardTitle: React.FC<{children: React.ReactNode, className?: string, subtitle?: string}> = ({ children, className, subtitle }) => (
    <div className={`mb-5 border-b border-white/5 pb-3 ${className}`}>
        <h3 className="text-sm font-black uppercase tracking-[0.25em] text-indigo-400/90">
            {children}
        </h3>
        {subtitle && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{subtitle}</p>}
    </div>
);

export const Placeholder: React.FC<{title: string, message: string}> = ({title, message}) => (
     <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
        <h3 className="text-slate-400 text-sm font-black uppercase tracking-widest mb-2">{title}</h3>
        <p className="text-slate-500 text-xs font-medium">{message}</p>
    </div>
);

export default Card;