import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const SelectSimple = ({
  options = [],
  value,
  onChange,
  placeholder = 'Selecciona...',
  loading = false,
  error = null,
  onRetry,
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const optionsRef = useRef([]);

  const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);

  const handleToggle = useCallback(() => {
    if (disabled || loading) return;
    setIsOpen(prev => !prev);
  }, [disabled, loading]);

  const handleSelect = useCallback((optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  }, [onChange]);

  const handleClickOutside = useCallback((event) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      const selectedIndex = options.findIndex(opt => opt.value === value);
      setActiveIndex(selectedIndex > -1 ? selectedIndex : 0);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClickOutside, options, value]);

  useEffect(() => {
    if (isOpen && activeIndex >= 0 && optionsRef.current[activeIndex]) {
      optionsRef.current[activeIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [isOpen, activeIndex]);

  const handleKeyDown = (e) => {
    if (disabled || loading) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && activeIndex >= 0) {
          handleSelect(options[activeIndex].value);
        } else {
          handleToggle();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
            setIsOpen(true);
        } else {
            setActiveIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
         if (!isOpen) {
            setIsOpen(true);
        } else {
            setActiveIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      default:
        break;
    }
  };
  
  const displayValue = loading ? 'Cargando...' : selectedOption?.label || placeholder;

  return (
    <div className={cn('relative w-full', className)} ref={wrapperRef}>
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center justify-between w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          disabled || loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {displayValue}
        </span>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-sm"
          >
            <div
              role="listbox"
              className="max-h-80 overflow-y-auto p-1"
            >
              {error ? (
                <div className="p-4 text-center text-sm text-destructive flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5"/>
                  <p>{error}</p>
                  {onRetry && <Button variant="link" size="sm" onClick={onRetry}>Reintentar</Button>}
                </div>
              ) : options.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No hay opciones disponibles.
                </div>
              ) : (
                options.map((option, index) => (
                  <div
                    key={option.value}
                    ref={el => optionsRef.current[index] = el}
                    role="option"
                    aria-selected={value === option.value}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'px-3 py-2 text-sm rounded-md cursor-pointer hover:underline',
                      value === option.value ? 'font-semibold' : 'font-normal',
                      activeIndex === index && 'bg-muted'
                    )}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SelectSimple;