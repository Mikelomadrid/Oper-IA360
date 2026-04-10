import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, LogOut } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // Clear potentially corrupted local storage
    try {
        localStorage.removeItem('read_inbox_items');
    } catch (e) {
        console.error("Failed to clear storage", e);
    }
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-8 text-center font-sans">
          <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full border border-red-100">
            <h1 className="text-2xl font-bold text-red-700 mb-2">Algo salió mal</h1>
            <p className="text-gray-600 mb-6">
              La aplicación ha encontrado un error inesperado. Hemos registrado el problema.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Button onClick={this.handleReload} variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Recargar Página
                </Button>
                <Button onClick={this.handleReset} className="bg-red-600 hover:bg-red-700 gap-2">
                    <Home className="w-4 h-4" />
                    Volver al Inicio
                </Button>
                <Button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2">
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión (Forzar)
                </Button>
            </div>
            
            <details className="text-left mt-4 border-t pt-4">
                <summary className="cursor-pointer text-xs text-gray-500 font-medium mb-2 hover:text-gray-700">
                    Ver detalles técnicos
                </summary>
                <div className="p-4 bg-gray-50 rounded text-xs font-mono text-gray-700 overflow-auto max-h-48 border border-gray-200">
                    <p className="font-bold text-red-600 mb-2">{this.state.error?.toString()}</p>
                    <pre className="whitespace-pre-wrap break-all">
                    {this.state.errorInfo?.componentStack}
                    </pre>
                </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;