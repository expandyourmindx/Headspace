import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const AuthScreen: React.FC = () => {
  const { 
    signInWithEmail, 
    signUpWithEmail, 
    signInWithGoogle, 
    isFirebaseConfigured 
  } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName || undefined);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-50/50 p-4 font-sans" id="auth-screen-container">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md bg-white border border-zinc-200/80 rounded-3xl shadow-xl p-8 md:p-10 flex flex-col relative overflow-hidden"
        id="auth-card"
      >
        {/* Branding decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />

        {/* Header Block */}
        <div className="mb-8 select-none">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-1.5" id="auth-title">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-zinc-500 font-medium">
            {isSignUp ? 'Get started by setting up your workspace' : 'Sign in to access your spaces and boards'}
          </p>
        </div>

        {/* Warning if Firebase env variables are not set */}
        {!isFirebaseConfigured && (
          <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2.5 leading-relaxed" id="firebase-warning">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Missing environment variables!</span>
              <p className="mt-0.5 text-amber-700/90">
                Please add your Firebase credentials under <span className="font-semibold">Settings</span>. Configure keys: <code className="font-mono bg-amber-100 font-bold px-1 py-0.5 rounded text-amber-800">VITE_FIREBASE_API_KEY</code>, etc.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-start gap-2.5 leading-relaxed" 
            id="auth-error-msg"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <span className="font-bold">Authenticating error</span>
              <p className="mt-0.5 text-red-700/90">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Google Sign-in Option (Always first, separated by neat line) */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || !isFirebaseConfigured}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border border-zinc-200 text-zinc-700 font-medium text-sm rounded-xl hover:bg-zinc-50/80 active:bg-zinc-100/50 disabled:opacity-50 disabled:pointer-events-none transition-all duration-150 shadow-xs cursor-pointer"
          id="google-signin-btn"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.256-3.133C18.29 1.839 15.5 1 12.24 1 5.48 1 0 6.48 0 13.2s5.48 12.2 12.24 12.2c7.055 0 11.75-4.964 11.75-11.954 0-.805-.087-1.42-.19-1.961H12.24z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="relative my-6 select-none" id="auth-divider">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider font-extrabold text-zinc-400">
            <span className="bg-white px-3 font-sans">Or connect with Email</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" id="auth-form">
          {isSignUp && (
            <div className="flex flex-col gap-1.5" id="name-field-group">
              <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Amandeep Singh"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading || !isFirebaseConfigured}
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-2xs"
                  id="auth-name-input"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5" id="email-field-group">
            <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-zinc-400" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !isFirebaseConfigured}
                className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-2xs"
                id="auth-email-input"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5" id="password-field-group">
            <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-zinc-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || !isFirebaseConfigured}
                className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm transition-all shadow-2xs"
                id="auth-password-input"
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading || !isFirebaseConfigured}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
            id="auth-submit-btn"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              'Create Workspace Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Switch Link */}
        <div className="mt-6 text-center select-none" id="auth-switch-link-wrapper">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50"
            id="auth-switch-btn"
          >
            {isSignUp ? 'Already have an workspace? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
