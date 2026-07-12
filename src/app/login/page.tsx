'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg('Correo o contraseña incorrectos. Verifica tus credenciales.');
      setLoading(false);
    } else {
      // Si el login es exitoso, enviamos al operador a abrir su turno en la iglesia
      router.push('/apertura-turno');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Control de Camisetas</h1>
          <p className="text-sm text-gray-400 mt-2">Acceso exclusivo para operadores de iglesia</p>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/50 p-4 text-sm text-red-400 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@iglesia.com"
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg bg-gray-700 border border-gray-600 px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 transition shadow-lg shadow-blue-600/30"
          >
            {loading ? 'Verificando acceso...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}