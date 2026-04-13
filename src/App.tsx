import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Task, TaskCompletion, Reminder, ShoppingItem, UserPreferences, ThemeColor } from './types';
import { format, subDays, getDate, getDay, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CheckCircle2, 
  Calendar, 
  Home, 
  LogOut, 
  Clock,
  Sparkles,
  ListTodo,
  CheckCircle,
  LayoutGrid,
  Activity,
  Trophy,
  Menu,
  X,
  User as UserIcon,
  RefreshCw,
  Mail,
  Lock,
  CalendarDays,
  ChevronLeft,
  ShoppingBag,
  Sun,
  Cloud,
  CloudRain,
  Palette,
  Moon,
  Plus,
  Trash2,
  Settings,
  CloudSun,
  Bot,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTasksWithAI } from './services/groq';
import { Toaster, toast } from 'sonner';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  Timestamp,
  doc,
  deleteDoc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

// ROTINA FIXA EMBUTIDA NO CÓDIGO
const TASK_ROUTINE: Task[] = [
  // Diárias
  { id: 'd1', title: 'Varrer chão', frequency: 'daily', category: 'Diárias' },
  { id: 'd2', title: 'Tirar pó', frequency: 'daily', category: 'Diárias' },
  { id: 'd3', title: 'Arrumar cama', frequency: 'daily', category: 'Diárias' },
  { id: 'd4', title: 'Limpeza simples no banheiro', frequency: 'daily', category: 'Diárias' },
  // Semanais
  { id: 'w1', title: 'Lavar roupas', frequency: 'weekly', category: 'Semanais', dayOfWeek: 6 }, // Sábado
  { id: 'w2', title: 'Limpeza profunda da cozinha', frequency: 'weekly', category: 'Semanais', dayOfWeek: 3 }, // Quarta
  // Quinzenais (Dias 1 e 15)
  { id: 'q1', title: 'Limpeza de Tomadas', frequency: 'biweekly', category: 'Quinzenais', dayOfMonth: 1 },
  { id: 'q2', title: 'Tirar teias e pó de paredes', frequency: 'biweekly', category: 'Quinzenais', dayOfMonth: 15 },
  { id: 'q3', title: 'Lavar chão da casa', frequency: 'biweekly', category: 'Quinzenais', dayOfMonth: 1 },
  // Mensais (Escalonadas no início do mês)
  { id: 'm1', title: 'Limpeza armários', frequency: 'monthly', category: 'Mensais', dayOfMonth: 1 },
  { id: 'm2', title: 'Limpeza geladeira', frequency: 'monthly', category: 'Mensais', dayOfMonth: 2 },
  { id: 'm3', title: 'Arrumar guarda roupas', frequency: 'monthly', category: 'Mensais', dayOfMonth: 3 },
  { id: 'm4', title: 'Limpeza chuveiro', frequency: 'monthly', category: 'Mensais', dayOfMonth: 4 },
  { id: 'm5', title: 'Limpeza de lustre', frequency: 'monthly', category: 'Mensais', dayOfMonth: 5 },
  { id: 'm6', title: 'Limpeza de janelas', frequency: 'monthly', category: 'Mensais', dayOfMonth: 6 },
  { id: 'm7', title: 'Limpeza das portas', frequency: 'monthly', category: 'Mensais', dayOfMonth: 7 },
  { id: 'm8', title: 'Limpeza sofá e colchão', frequency: 'monthly', category: 'Mensais', dayOfMonth: 8 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMorningSummary, setShowMorningSummary] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'social' | 'email' | 'forgot'>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // New Features State
  const [customTasks, setCustomTasks] = useState<Task[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    darkMode: false,
    themeColor: 'violet'
  });
  const [weather, setWeather] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShoppingOpen, setIsShoppingOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form states for new task
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskFreq, setNewTaskFreq] = useState<any>('daily');
  const [newTaskCat, setNewTaskCat] = useState('Limpeza');
  const [newTaskReminderTime, setNewTaskReminderTime] = useState('07:00');
  const [newTaskReminderEnabled, setNewTaskReminderEnabled] = useState(false);

  // Form state for shopping item
  const [newShoppingItem, setNewShoppingItem] = useState('');

  // Monitorar mudança de dia (Auto-Refresh)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      if (now.getDate() !== currentDate.getDate()) {
        setCurrentDate(now); // Renova a lista automaticamente à meia-noite
      }
    }, 60000); // Checa a cada minuto
    return () => clearInterval(timer);
  }, [currentDate]);

  // Check for morning summary (after 7 AM)
  useEffect(() => {
    if (!user) return;
    
    const checkMorningSummary = () => {
      const now = new Date();
      const hour = now.getHours();
      const todayKey = format(now, 'yyyy-MM-dd');
      const lastSeen = localStorage.getItem(`morning_summary_${user.uid}`);
      
      // Se for depois das 7h e ainda não viu hoje
      if (hour >= 7 && lastSeen !== todayKey) {
        setShowMorningSummary(true);
      }
    };

    checkMorningSummary();
  }, [user]);

  // Check notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    setNotificationError(null);
    setShowNotificationPrompt(false);
    
    if (!('Notification' in window)) {
      setNotificationError('Seu navegador não suporta notificações.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        try {
          new Notification('Task Home', {
            body: 'Lembretes ativados! Você receberá avisos nos horários definidos.',
            icon: '/favicon.ico'
          });
        } catch (e) {
          console.error('Erro ao mostrar notificação nativa:', e);
        }
      } else if (permission === 'denied') {
        setNotificationError('Permissão negada. Ative nas configurações do navegador.');
      }
    } catch (error) {
      console.error('Notification permission error:', error);
      setNotificationError('Erro ao solicitar permissão.');
    }
  };

  const dismissMorningSummary = () => {
    if (user) {
      localStorage.setItem(`morning_summary_${user.uid}`, format(new Date(), 'yyyy-MM-dd'));
    }
    setShowMorningSummary(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia! ☀️";
    if (hour < 18) return "Boa tarde! 🌤️";
    return "Boa noite! 🌙";
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch completions
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const thirtyDaysAgo = subDays(new Date(), 30);
    const q = query(
      collection(db, 'completions'),
      where('userId', '==', user.uid),
      where('completedAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const completionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        completedAt: doc.data().completedAt?.toDate() || new Date()
      } as TaskCompletion));
      setCompletions(completionsData);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Fetch custom tasks
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'custom_tasks'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isCustom: true
      } as Task));
      setCustomTasks(tasks);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Fetch shopping list
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'shopping_list'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ShoppingItem));
      setShoppingList(items.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Fetch preferences
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'preferences', user.uid), (doc) => {
      if (doc.exists()) {
        setPreferences(doc.data() as UserPreferences);
      }
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Fetch weather
  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        console.log(`Buscando clima para: ${lat}, ${lon}`);
        // Usando os parâmetros mais recentes da API Open-Meteo
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        if (!res.ok) throw new Error(`Falha na resposta da API: ${res.status}`);
        
        const data = await res.json();
        console.log('Dados do clima recebidos:', data);
        
        if (!data.current || data.current.temperature_2m === undefined) {
          throw new Error('Dados meteorológicos incompletos na resposta');
        }

        const code = data.current.weather_code;
        const temperature = data.current.temperature_2m;
        
        let condition = 'Limpo';
        let icon = 'sun';
        
        // Mapeamento expandido e corrigido de códigos WMO
        if (code === 0) { 
          condition = 'Céu Limpo'; 
          icon = 'sun'; 
        } else if (code >= 1 && code <= 3) { 
          condition = 'Parcialmente Nublado'; 
          icon = 'cloud-sun'; 
        } else if (code >= 45 && code <= 48) { 
          condition = 'Nevoeiro'; 
          icon = 'cloud'; 
        } else if (code >= 51 && code <= 67) { 
          condition = 'Chuva'; 
          icon = 'cloud-rain'; 
        } else if (code >= 80 && code <= 82) { 
          condition = 'Chuva'; 
          icon = 'cloud-rain'; 
        } else if (code >= 71 && code <= 77) { 
          condition = 'Neve'; 
          icon = 'cloud'; 
        } else if (code >= 85 && code <= 86) { 
          condition = 'Neve'; 
          icon = 'cloud'; 
        } else if (code >= 95) { 
          condition = 'Tempestade'; 
          icon = 'cloud-rain'; 
        }

        setWeather({
          temp: Math.round(temperature),
          condition,
          icon
        });
      } catch (e) {
        console.error('Erro ao buscar clima:', e);
        // Se falhar com coordenadas específicas, tenta o fallback se ainda não for o fallback
        if (lat !== -23.5505 || lon !== -46.6333) {
          console.log('Tentando fallback para São Paulo...');
          fetchWeather(-23.5505, -46.6333);
        }
      }
    };

    const getPosition = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetchWeather(pos.coords.latitude, pos.coords.longitude);
          },
          (error) => {
            console.warn('Erro de geolocalização, usando fallback:', error.message);
            fetchWeather(-23.5505, -46.6333); // Fallback para São Paulo
          },
          { timeout: 10000, enableHighAccuracy: false }
        );
      } else {
        console.warn('Geolocalização não suportada, usando fallback');
        fetchWeather(-23.5505, -46.6333);
      }
    };

    getPosition();
  }, []);

  // Update theme classes
  useEffect(() => {
    const root = window.document.documentElement;
    if (preferences.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Theme colors
    const colors: Record<ThemeColor, string> = {
      violet: '#7c3aed',
      ocean: '#0ea5e9',
      forest: '#10b981',
      minimalist: '#64748b',
      pink: '#db2777',
      orange: '#f59e0b'
    };
    root.style.setProperty('--primary-color', colors[preferences.themeColor]);
  }, [preferences]);

  // Combined tasks
  const allTasks = useMemo(() => {
    return [...TASK_ROUTINE, ...customTasks];
  }, [customTasks]);
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'reminders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remindersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reminder));
      setReminders(remindersData);
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Custom Reminder Notification Logic
  useEffect(() => {
    if (!notificationsEnabled || !user) return;

    const checkReminders = () => {
      const now = new Date();
      const currentTime = format(now, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');

      reminders.forEach(reminder => {
        if (reminder.enabled && reminder.time === currentTime) {
          const task = TASK_ROUTINE.find(t => t.id === reminder.taskId);
          if (task && isTaskDueOnDate(task, now)) {
            // Check if already notified this minute to avoid multiple notifications
            const lastNotified = localStorage.getItem(`last_notified_${reminder.id}_${todayStr}`);
            if (lastNotified !== currentTime) {
              // In-app banner (like WhatsApp)
              toast('Lembrete de Tarefa', {
                description: `Hora de: ${task.title}`,
                duration: 10000,
                icon: '⏰',
              });

              try {
                // Native Notification
                new Notification('Lembrete de Tarefa', {
                  body: `Hora de: ${task.title}`,
                  icon: '/favicon.ico'
                });
              } catch (e) {
                console.error('Erro ao mostrar notificação nativa:', e);
              }

              localStorage.setItem(`last_notified_${reminder.id}_${todayStr}`, currentTime);
            }
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [notificationsEnabled, reminders, user]);

  const weeklySectionRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewMode === 'all') {
      // Pequeno delay para garantir que o conteúdo foi renderizado
      setTimeout(() => {
        const element = document.getElementById('section-Semanais');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [viewMode]);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  }, []);

  const loginAnonymously = useCallback(async () => {
    setAuthError('');
    try {
      // Importante: O provedor "Anonymous" deve estar ativado no Firebase Console
      await signInAnonymously(auth);
    } catch (error: any) {
      setAuthError('Erro ao entrar como convidado. Verifique se o login anônimo está ativado no Firebase.');
      console.error('Anonymous Login error:', error);
    }
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Atualiza o perfil com o nome completo
        await updateProfile(newUser, {
          displayName: `${firstName} ${lastName}`
        });

        // Salva dados adicionais no Firestore
        await setDoc(doc(db, 'users', newUser.uid), {
          firstName,
          lastName,
          birthDate,
          email,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este email já está em uso. Tente fazer login.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('Senha muito fraca. A senha deve ter pelo menos 6 caracteres.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('Email ou senha incorretos. Verifique seus dados.');
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError('O login por email não está ativado no Firebase Console. Ative-o em Authentication > Sign-in method.');
      } else if (error.code === 'auth/invalid-email') {
        setAuthError('O endereço de email digitado é inválido.');
      } else {
        setAuthError('Erro na autenticação: ' + (error.message || 'Ocorreu um erro inesperado.'));
      }
      console.error('Email Auth error:', error);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (error: any) {
      setAuthError('Erro ao enviar email de recuperação. Verifique o endereço digitado.');
      console.error('Forgot password error:', error);
    }
  };

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const toggleTask = useCallback(async (taskId: string) => {
    if (!user) return;
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    const existing = completions.find(c => c.taskId === taskId && c.date === todayStr);

    if (existing) {
      await deleteDoc(doc(db, 'completions', existing.id!));
    } else {
      await addDoc(collection(db, 'completions'), {
        taskId,
        userId: user.uid,
        completedAt: serverTimestamp(),
        date: todayStr
      });
    }
  }, [user, currentDate, completions]);

  const updateReminder = useCallback(async (taskId: string, time: string, enabled: boolean) => {
    if (!user) return;
    const existing = reminders.find(r => r.taskId === taskId);

    if (existing) {
      await setDoc(doc(db, 'reminders', existing.id!), {
        ...existing,
        time,
        enabled
      });
    } else {
      await addDoc(collection(db, 'reminders'), {
        taskId,
        userId: user.uid,
        time,
        enabled
      });
    }
  }, [user, reminders]);

  const isTaskDueOnDate = (task: Task, date: Date) => {
    const dayOfMonth = getDate(date);
    const dayOfWeek = getDay(date);
    switch (task.frequency) {
      case 'daily': return true;
      case 'weekly': return task.dayOfWeek === dayOfWeek || (task.isCustom && getDay(new Date()) === dayOfWeek);
      case 'biweekly': return dayOfMonth === 1 || dayOfMonth === 15;
      case 'monthly': return task.dayOfMonth === dayOfMonth || (task.isCustom && getDate(new Date()) === dayOfMonth);
      case 'yearly': return task.isCustom && format(new Date(), 'MM-dd') === format(date, 'MM-dd');
      default: return false;
    }
  };

  const todayStr = format(currentDate, 'yyyy-MM-dd');
  
  // Weather-based suggestions
  const weatherSuggestions = useMemo(() => {
    if (!weather) return [];
    const suggestions: string[] = [];
    if (weather.condition === 'Limpo' || weather.condition === 'Céu Limpo' || weather.condition === 'Parcialmente Nublado') {
      suggestions.push('Lavar janelas', 'Lavar cortinas', 'Limpar área externa');
    } else if (weather.condition === 'Chuva' || weather.condition === 'Tempestade' || weather.condition === 'Nevoeiro') {
      suggestions.push('Organizar armários', 'Limpeza profunda da cozinha', 'Arrumar gavetas');
    }
    return suggestions;
  }, [weather]);

  const tasksDueToday = useMemo(() => {
    const baseTasks = allTasks.filter(t => isTaskDueOnDate(t, currentDate));
    // Add weather suggestions as temporary tasks if not already there
    const suggestedTasks = weatherSuggestions.map((title, i) => ({
      id: `suggested-${i}`,
      title,
      frequency: 'daily' as const,
      category: 'Sugestão do Clima',
      isWeatherSuggestion: true
    }));
    return [...baseTasks, ...suggestedTasks];
  }, [currentDate, allTasks, weatherSuggestions]);

  const isCompletedToday = (taskId: string) => completions.some(c => c.taskId === taskId && c.date === todayStr);
  const completedCount = tasksDueToday.filter(t => isCompletedToday(t.id)).length;
  const tasksPendingToday = tasksDueToday.length - completedCount;
  const progress = tasksDueToday.length > 0 ? (completedCount / tasksDueToday.length) * 100 : 0;

  const addCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle) return;
    try {
      const docRef = await addDoc(collection(db, 'custom_tasks'), {
        userId: user.uid,
        title: newTaskTitle,
        frequency: newTaskFreq,
        category: newTaskCat,
        createdAt: serverTimestamp()
      });

      if (newTaskReminderEnabled) {
        await addDoc(collection(db, 'reminders'), {
          taskId: docRef.id,
          userId: user.uid,
          time: newTaskReminderTime,
          enabled: true
        });
      }

      setNewTaskTitle('');
      setNewTaskReminderEnabled(false);
      setNewTaskReminderTime('07:00');
      setIsAddTaskOpen(false);
    } catch (e) {
      console.error('Error adding custom task:', e);
    }
  };

  const deleteCustomTask = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'custom_tasks', id));
    } catch (e) {
      console.error('Error deleting custom task:', e);
    }
  }, []);

  const addShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newShoppingItem) return;
    try {
      await addDoc(collection(db, 'shopping_list'), {
        userId: user.uid,
        name: newShoppingItem,
        completed: false,
        createdAt: serverTimestamp()
      });
      setNewShoppingItem('');
    } catch (e) {
      console.error('Error adding shopping item:', e);
    }
  };

  const toggleShoppingItem = async (item: ShoppingItem) => {
    try {
      await setDoc(doc(db, 'shopping_list', item.id!), {
        ...item,
        completed: !item.completed
      });
    } catch (e) {
      console.error('Error toggling shopping item:', e);
    }
  };

  const deleteShoppingItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shopping_list', id));
    } catch (e) {
      console.error('Error deleting shopping item:', e);
    }
  };

  const updatePreferences = useCallback(async (newPrefs: Partial<UserPreferences>) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'preferences', user.uid), {
        ...preferences,
        ...newPrefs
      }, { merge: true });
    } catch (e) {
      console.error('Error updating preferences:', e);
    }
  }, [user, preferences]);

  const goToToday = useCallback(() => setViewMode('today'), []);
  const goToAll = useCallback(() => setViewMode('all'), []);
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const openShopping = useCallback(() => setIsShoppingOpen(true), []);
  const openAddTask = useCallback(() => setIsAddTaskOpen(true), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center transition-colors duration-300">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-primary flex flex-col items-center gap-4"
        >
          <RefreshCw className="w-12 h-12 animate-spin-slow" />
          <p className="font-bold text-slate-500 dark:text-slate-400">Sincronizando Rotina...</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bento-card-white dark:bg-slate-900 p-8 md:p-12 text-center border border-slate-200/50 dark:border-slate-800/50 shadow-2xl"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-[24px] md:rounded-[28px] flex items-center justify-center mx-auto mb-8 md:mb-10 shadow-xl shadow-primary/20 animate-float">
            <Home className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-4 tracking-tight text-slate-900 dark:text-white">Task Home</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 md:mb-12 text-balance text-sm md:text-base leading-relaxed">
            Sua rotina doméstica organizada automaticamente, todos os dias.
          </p>
          <div className="space-y-6">
            {authMode === 'social' ? (
              <>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-8">
                  <button 
                    onClick={() => { setAuthMode('social'); setIsRegistering(false); }}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${!isRegistering && authMode === 'social' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    Social
                  </button>
                  <button 
                    onClick={() => { setAuthMode('email'); setIsRegistering(true); }}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${isRegistering ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    Cadastro
                  </button>
                </div>

                <button 
                  onClick={login}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-4 shadow-xl shadow-slate-900/10 active:scale-95"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-6 h-6 dark:invert-0 invert" alt="Google" />
                  Entrar com Google
                </button>
                
                <button 
                  onClick={() => { setAuthMode('email'); setIsRegistering(false); }}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-100 dark:border-slate-700 py-5 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-4 active:scale-95"
                >
                  <Mail className="w-6 h-6 text-primary" />
                  Entrar com Email
                </button>

                <div className="flex items-center gap-4 my-8">
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ou</span>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                </div>

                <button 
                  onClick={loginAnonymously}
                  className="w-full bg-primary/10 text-primary py-5 rounded-2xl font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-4 active:scale-95"
                >
                  <UserIcon className="w-6 h-6" />
                  Entrar como Convidado
                </button>
                {authError && <p className="text-red-500 text-xs font-bold mt-4">{authError}</p>}
              </>
            ) : authMode === 'email' ? (
              <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-8">
                  <button 
                    type="button"
                    onClick={() => { setIsRegistering(false); setAuthError(''); }}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${!isRegistering ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    Login
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsRegistering(true); setAuthError(''); }}
                    className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${isRegistering ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
                  >
                    Cadastro
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <button 
                    type="button"
                    onClick={() => setAuthMode('social')}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </button>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {isRegistering ? 'Criar sua conta' : 'Acesse sua conta'}
                  </h2>
                </div>

                {isRegistering && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Nome</label>
                      <input 
                        type="text" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                        placeholder="João"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Sobrenome</label>
                      <input 
                        type="text" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                        placeholder="Silva"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Data de Nascimento</label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <input 
                          type="date" 
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {authError && <p className="text-red-500 text-[10px] font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{authError}</p>}
                
                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/10 active:scale-95 mt-4"
                >
                  {isRegistering ? 'Criar Conta Grátis' : 'Entrar na Conta'}
                </button>

                <div className="flex flex-col gap-3 mt-6">
                  {!isRegistering && (
                    <button 
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                      className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-primary transition-colors text-center"
                    >
                      Esqueceu a senha? Recuperar conta
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
                <div className="flex items-center gap-2 mb-6">
                  <button 
                    type="button"
                    onClick={() => setAuthMode('email')}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  </button>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Recuperar Conta</h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Insira seu email para receber um link de redefinição de senha.</p>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 pl-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm text-slate-900 dark:text-white"
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                </div>

                {authError && <p className="text-red-500 text-[10px] font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{authError}</p>}
                {authSuccess && <p className="text-green-600 dark:text-green-400 text-[10px] font-bold bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">{authSuccess}</p>}

                <button 
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xl shadow-slate-900/10 active:scale-95 mt-4"
                >
                  Enviar Link de Recuperação
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || !user) return;
    
    setIsAILoading(true);
    setAiError(null);
    
    try {
      const generatedTasks = await generateTasksWithAI(aiPrompt);
      
      if (generatedTasks.length === 0) {
        setAiError("A IA não conseguiu gerar tarefas. Tente ser mais específico.");
        return;
      }

      // Add generated tasks to custom tasks
      for (const t of generatedTasks) {
        const newTask = {
          title: t.title,
          frequency: 'daily',
          category: t.category,
          userId: user.uid,
          createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'custom_tasks'), newTask);
        
        // Add default reminder for the new task
        await addDoc(collection(db, 'reminders'), {
          taskId: docRef.id,
          userId: user.uid,
          time: '09:00',
          enabled: false
        });
      }
      
      setAiPrompt('');
      setIsAIOpen(false);
      
      // Show success notification
      toast.success(`${generatedTasks.length} tarefas criadas com sucesso!`);
    } catch (error: any) {
      console.error("Erro na IA:", error);
      setAiError(error.message || "Ocorreu um erro ao gerar as tarefas.");
    } finally {
      setIsAILoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row">
      <Toaster position="top-center" theme={preferences.darkMode ? 'dark' : 'light'} richColors />
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-24 bg-white border-r border-slate-200/50 flex-col items-center py-10 fixed h-full z-20">
        <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/20 mb-12">
          <Home className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex-1 flex flex-col gap-6">
          <SidebarIconButton 
            active={viewMode === 'today'} 
            onClick={goToToday} 
            icon={<Activity className="w-6 h-6" />} 
            label="Hoje" 
            badge={tasksPendingToday > 0 ? tasksPendingToday : undefined}
          />
          <SidebarIconButton 
            active={viewMode === 'all'} 
            onClick={goToAll} 
            icon={<LayoutGrid className="w-6 h-6" />} 
            label="Cronograma" 
          />
          <SidebarIconButton 
            active={isShoppingOpen} 
            onClick={openShopping} 
            icon={<ShoppingBag className="w-6 h-6" />} 
            label="Lista de Compras" 
            badge={shoppingList.filter(i => !i.completed).length || undefined}
          />
          <SidebarIconButton 
            active={notificationsEnabled} 
            onClick={() => notificationsEnabled ? null : setShowNotificationPrompt(true)} 
            icon={<Clock className={`w-6 h-6 ${notificationsEnabled ? 'text-green-400' : ''}`} />} 
            label={notificationsEnabled ? "Lembretes Ativos" : "Ativar Lembretes"} 
          />
          {notificationError && (
            <div className="absolute left-24 bg-red-500 text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50">
              {notificationError}
              <button onClick={() => setNotificationError(null)} className="ml-2 hover:text-red-200">×</button>
            </div>
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-6 items-center">
          <button onClick={openSettings} className="p-3 text-slate-400 hover:text-violet-500 transition-all">
            <Settings className="w-6 h-6" />
          </button>
          <div className="w-12 h-12 bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-sm">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-6 h-6 text-slate-400 m-3" />
            )}
          </div>
          <button onClick={logout} className="p-3 text-slate-400 hover:text-red-500 transition-all">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-24 p-6 lg:p-10 max-w-[1600px] mx-auto w-full pb-24 lg:pb-10">
        {/* Mobile Header */}
        <div className="lg:hidden flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-6 h-6 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">Task Home</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsAIOpen(true)}
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-primary hover:bg-primary/5 transition-all active:scale-95"
              title="Assistente IA"
            >
              <Bot className="w-6 h-6" />
            </button>
            <button 
              onClick={logout} 
              className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all active:scale-95"
              title="Sair da conta"
            >
              <LogOut className="w-6 h-6" />
            </button>
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white active:scale-95">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Welcome Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-8 bento-card bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 md:p-10 flex flex-col justify-between transition-colors duration-300"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <p className="text-primary font-black text-[10px] md:text-xs uppercase tracking-[0.2em] mb-4">
                  {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white mb-4">
                  Olá, {user.displayName?.split(' ')[0] || 'Visitante'}!
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg max-w-md leading-relaxed">
                  {progress === 100 
                    ? "Tudo pronto por hoje! Sua casa está impecável. ✨"
                    : `Você tem ${tasksDueToday.length - completedCount} tarefas para hoje.`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {weather && (
                  <div className="p-4 md:p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-white/50 dark:border-slate-700/50 flex items-center gap-4 md:gap-6 shadow-sm">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center shadow-sm">
                      {weather.icon === 'sun' && <Sun className="w-6 h-6 md:w-8 md:h-8 text-amber-500" />}
                      {weather.icon === 'cloud-sun' && <CloudSun className="w-6 h-6 md:w-8 md:h-8 text-amber-500" />}
                      {weather.icon === 'cloud' && <Cloud className="w-6 h-6 md:w-8 md:h-8 text-slate-400 dark:text-slate-300" />}
                      {weather.icon === 'cloud-rain' && <CloudRain className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />}
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{weather.temp}°C</p>
                      <p className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{weather.condition}</p>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => setIsAIOpen(true)}
                  className="hidden lg:flex p-4 md:p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-white/50 dark:border-slate-700/50 text-primary hover:bg-primary/5 transition-all active:scale-95 group shadow-sm"
                  title="Assistente IA"
                >
                  <Bot className="w-6 h-6 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={logout}
                  className="hidden lg:flex p-4 md:p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-white/50 dark:border-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-all active:scale-95 group shadow-sm"
                  title="Sair da conta"
                >
                  <LogOut className="w-6 h-6 md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
            <div className="mt-8 md:mt-10 flex flex-wrap items-center gap-3 md:gap-4">
              <button 
                onClick={goToToday}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all ${viewMode === 'today' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Hoje
              </button>
              <button 
                onClick={goToAll}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all ${viewMode === 'all' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                Cronograma
              </button>
              <button 
                onClick={openAddTask}
                className="px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2 text-sm md:text-base"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Nova Tarefa
              </button>
            </div>
          </motion.div>

          {/* Progress Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 bento-card bg-primary p-6 md:p-10 flex flex-col items-center justify-center text-center text-white border-none shadow-xl shadow-primary/20 transition-colors duration-300"
          >
            <div className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center mb-6">
              <svg className="w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="40%" className="fill-none stroke-white/10 stroke-[12] md:stroke-[16]" />
                <motion.circle 
                  cx="50%" cy="50%" r="40%" 
                  className="fill-none stroke-white stroke-[12] md:stroke-[16] stroke-round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: progress / 100 }}
                  transition={{ duration: 1.5, ease: "circOut" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl md:text-5xl font-black">{Math.round(progress)}%</span>
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60">Concluído</span>
              </div>
            </div>
            <h3 className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-white">Meta Diária</h3>
            <p className="text-white/80 text-xs md:text-sm font-medium">
              {completedCount} de {tasksDueToday.length} tarefas
            </p>
          </motion.div>

          {/* Task Area */}
          <div className="lg:col-span-12 mt-4">
            <AnimatePresence mode="wait">
              {viewMode === 'today' ? (
                <motion.div 
                  key="today"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">Foco de Hoje</h2>
                    <div className="hidden sm:flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Automático</span>
                    </div>
                  </div>

                  {tasksDueToday.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {tasksDueToday.map((task, idx) => (
                        <BentoTaskItem 
                          key={task.id} 
                          task={task} 
                          completed={isCompletedToday(task.id)} 
                          reminder={reminders.find(r => r.taskId === task.id)}
                          onToggle={toggleTask}
                          onUpdateReminder={updateReminder}
                          onDeleteCustomTask={deleteCustomTask}
                          delay={idx * 0.05}
                          currentDate={currentDate}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bento-card-white dark:bg-slate-900 p-20 text-center flex flex-col items-center border border-slate-200/50 dark:border-slate-800/50">
                      <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-[32px] flex items-center justify-center mb-8">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                      </div>
                      <h3 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">Tudo em ordem!</h3>
                      <p className="text-slate-500 dark:text-slate-400">Nenhuma tarefa agendada para hoje.</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="all"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-16"
                >
                  <BentoCategorySection 
                    title="Diárias" 
                    icon={<Clock className="w-6 h-6" />} 
                    tasks={TASK_ROUTINE.filter(t => t.frequency === 'daily')}
                    completions={completions}
                    reminders={reminders}
                    onToggle={toggleTask}
                    onUpdateReminder={updateReminder}
                    currentDate={currentDate}
                  />
                  <BentoCategorySection 
                    title="Semanais" 
                    icon={<Calendar className="w-6 h-6" />} 
                    tasks={TASK_ROUTINE.filter(t => t.frequency === 'weekly')}
                    completions={completions}
                    reminders={reminders}
                    onToggle={toggleTask}
                    onUpdateReminder={updateReminder}
                    currentDate={currentDate}
                  />
                  <BentoCategorySection 
                    title="Quinzenais" 
                    icon={<LayoutGrid className="w-6 h-6" />} 
                    tasks={TASK_ROUTINE.filter(t => t.frequency === 'biweekly')}
                    completions={completions}
                    reminders={reminders}
                    onToggle={toggleTask}
                    onUpdateReminder={updateReminder}
                    currentDate={currentDate}
                  />
                  <BentoCategorySection 
                    title="Mensais" 
                    icon={<ListTodo className="w-6 h-6" />} 
                    tasks={TASK_ROUTINE.filter(t => t.frequency === 'monthly')}
                    completions={completions}
                    reminders={reminders}
                    onToggle={toggleTask}
                    onUpdateReminder={updateReminder}
                    currentDate={currentDate}
                  />
                  {customTasks.length > 0 && (
                    <BentoCategorySection 
                      title="Minhas Tarefas" 
                      icon={<Plus className="w-6 h-6" />} 
                      tasks={customTasks}
                      completions={completions}
                      reminders={reminders}
                      onToggle={toggleTask}
                      onUpdateReminder={updateReminder}
                      onDeleteCustomTask={deleteCustomTask}
                      currentDate={currentDate}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-80 bg-white dark:bg-slate-900 z-50 lg:hidden p-10 flex flex-col shadow-2xl rounded-r-[40px] border-r border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Home className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold text-xl text-slate-900 dark:text-white">Task Home</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-500 dark:text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 space-y-4">
                <SidebarMobileLink 
                  active={viewMode === 'today'} 
                  onClick={() => { goToToday(); setIsSidebarOpen(false); }} 
                  icon={<Activity className="w-6 h-6" />} 
                  label="Hoje" 
                  badge={tasksPendingToday > 0 ? tasksPendingToday : undefined}
                />
                <SidebarMobileLink 
                  active={viewMode === 'all'} 
                  onClick={() => { goToAll(); setIsSidebarOpen(false); }} 
                  icon={<LayoutGrid className="w-6 h-6" />} 
                  label="Cronograma" 
                />
                <SidebarMobileLink 
                  active={isShoppingOpen} 
                  onClick={() => { openShopping(); setIsSidebarOpen(false); }} 
                  icon={<ShoppingBag className="w-6 h-6" />} 
                  label="Lista de Compras" 
                  badge={shoppingList.filter(i => !i.completed).length || undefined}
                />
                <SidebarMobileLink 
                  active={notificationsEnabled} 
                  onClick={() => { setShowNotificationPrompt(true); setIsSidebarOpen(false); }} 
                  icon={<Clock className={`w-6 h-6 ${notificationsEnabled ? 'text-green-500' : ''}`} />} 
                  label={notificationsEnabled ? "Lembretes Ativos" : "Ativar Lembretes"} 
                />
                {notificationError && (
                  <p className="text-red-500 text-[10px] font-bold px-5 py-2 bg-red-50 rounded-xl mx-5">
                    {notificationError}
                  </p>
                )}
              </nav>

              <div className="mt-auto pt-10 border-t border-slate-100 space-y-4">
                <button onClick={() => { openSettings(); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 p-5 text-slate-500 hover:text-violet-500 transition-all font-black">
                  <Settings className="w-6 h-6" />
                  Configurações
                </button>
                <button onClick={logout} className="w-full flex items-center gap-4 p-5 text-slate-500 hover:text-red-500 transition-all font-black">
                  <LogOut className="w-6 h-6" />
                  Sair da Conta
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Morning Summary Modal */}
      <AnimatePresence>
        {showMorningSummary && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismissMorningSummary}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bento-card-white dark:bg-slate-900 p-6 md:p-10 overflow-hidden max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="absolute top-0 right-0 p-4 md:p-6">
                <button onClick={dismissMorningSummary} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-5 h-5 md:w-6 md:h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center mb-8 md:mb-10">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-[24px] md:rounded-[28px] flex items-center justify-center mb-4 md:mb-6 shadow-xl shadow-primary/20">
                  <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">{getGreeting()}</h2>
                <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">Aqui está sua rotina para hoje:</p>
              </div>

              <div className="space-y-3 md:space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {tasksDueToday.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white dark:bg-slate-900 rounded-lg md:rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
                      <ListTodo className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-black text-slate-900 dark:text-white leading-tight text-sm md:text-base">{task.title}</p>
                      <p className="text-[9px] md:text-[10px] font-bold text-primary uppercase tracking-widest">{task.category}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={dismissMorningSummary}
                className="w-full mt-8 md:mt-10 bg-primary text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-95"
              >
                Vamos começar!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bento-card-white dark:bg-slate-900 p-6 md:p-10 overflow-hidden max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Configurações</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="space-y-6 md:space-y-8">
                <div>
                  <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block">Tema Visual</label>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <button 
                      onClick={() => updatePreferences({ darkMode: false })}
                      className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex items-center gap-2 md:gap-3 transition-all ${!preferences.darkMode ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      <Sun className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="font-bold text-sm md:text-base">Claro</span>
                    </button>
                    <button 
                      onClick={() => updatePreferences({ darkMode: true })}
                      className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 flex items-center gap-2 md:gap-3 transition-all ${preferences.darkMode ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      <Moon className="w-4 h-4 md:w-5 md:h-5" />
                      <span className="font-bold text-sm md:text-base">Escuro</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block">Cor do Tema</label>
                  <div className="grid grid-cols-4 gap-3 md:gap-4">
                    {(['violet', 'ocean', 'forest', 'minimalist', 'pink', 'orange'] as ThemeColor[]).map((color) => {
                      const colorMap: Record<ThemeColor, string> = {
                        violet: '#7c3aed',
                        ocean: '#0ea5e9',
                        forest: '#10b981',
                        minimalist: '#64748b',
                        pink: '#db2777',
                        orange: '#f59e0b'
                      };
                      return (
                        <button 
                          key={color}
                          onClick={() => updatePreferences({ themeColor: color })}
                          className={`w-full aspect-square rounded-xl md:rounded-2xl border-4 transition-all ${preferences.themeColor === color ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: colorMap[color] }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shopping List Modal */}
      <AnimatePresence>
        {isShoppingOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShoppingOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bento-card-white dark:bg-slate-900 p-6 md:p-10 overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Lista de Compras</h2>
                <button onClick={() => setIsShoppingOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <form onSubmit={addShoppingItem} className="flex gap-2 md:gap-3 mb-6 md:mb-8">
                <input 
                  type="text" 
                  value={newShoppingItem}
                  onChange={(e) => setNewShoppingItem(e.target.value)}
                  placeholder="Ex: Detergente..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm md:text-base text-slate-900 dark:text-white"
                />
                <button type="submit" className="bg-primary text-white p-3 md:p-4 rounded-xl md:rounded-2xl hover:opacity-90 transition-all">
                  <Plus className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {shoppingList.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group">
                    <button 
                      onClick={() => toggleShoppingItem(item)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-green-500 border-green-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}
                    >
                      {item.completed && <CheckCircle className="w-4 h-4 text-white" />}
                    </button>
                    <span className={`flex-1 font-bold ${item.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                      {item.name}
                    </span>
                    <button onClick={() => deleteShoppingItem(item.id!)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {shoppingList.length === 0 && (
                  <div className="text-center py-10">
                    <ShoppingBag className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-400 dark:text-slate-500 font-bold">Sua lista está vazia</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAIOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAIOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 md:p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Assistente IA</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Gerador de tarefas inteligente</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAIOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      O que você precisa organizar?
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Vou receber visitas no fim de semana e preciso limpar a casa toda. Crie tarefas para mim."
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none h-32 text-slate-900 dark:text-white"
                    />
                  </div>

                  {aiError && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-medium border border-red-100 dark:border-red-900/30">
                      {aiError}
                    </div>
                  )}

                  <button 
                    onClick={handleAIGenerate}
                    disabled={isAILoading || !aiPrompt.trim()}
                    className="w-full p-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isAILoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Gerando tarefas...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Gerar Tarefas com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAddTaskOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddTaskOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bento-card-white dark:bg-slate-900 p-6 md:p-10 overflow-hidden max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">Nova Tarefa</h2>
                <button onClick={() => setIsAddTaskOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <form onSubmit={addCustomTask} className="space-y-4 md:space-y-6">
                <div>
                  <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Título da Tarefa</label>
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Ex: Limpar filtro do ar"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm md:text-base text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Frequência</label>
                    <select 
                      value={newTaskFreq}
                      onChange={(e) => setNewTaskFreq(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-700 dark:text-slate-200 text-sm md:text-base"
                    >
                      <option value="daily">Diária</option>
                      <option value="weekly">Semanal</option>
                      <option value="biweekly">Quinzenal</option>
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Categoria</label>
                    <input 
                      type="text" 
                      value={newTaskCat}
                      onChange={(e) => setNewTaskCat(e.target.value)}
                      placeholder="Ex: Manutenção"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium text-sm md:text-base text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 md:p-6 rounded-2xl md:rounded-[32px] border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${newTaskReminderEnabled ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm md:text-base">Lembrete</h4>
                        <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Notificação no celular</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNewTaskReminderEnabled(!newTaskReminderEnabled)}
                      className={`w-12 h-6 rounded-full transition-all relative ${newTaskReminderEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newTaskReminderEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  {newTaskReminderEnabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="pt-4 border-t border-slate-200 dark:border-slate-700"
                    >
                      <label className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">Horário do Lembrete</label>
                      <input 
                        type="time" 
                        value={newTaskReminderTime}
                        onChange={(e) => setNewTaskReminderTime(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-3 md:p-4 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900 dark:text-white"
                      />
                    </motion.div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white py-4 md:py-5 rounded-xl md:rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-95 mt-4 text-sm md:text-base"
                >
                  Criar Tarefa
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showNotificationPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotificationPrompt(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bento-card-white dark:bg-slate-900 p-10 overflow-hidden border border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="absolute top-0 right-0 p-6">
                <button onClick={() => setShowNotificationPrompt(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 bg-primary rounded-[28px] flex items-center justify-center mb-6 shadow-xl shadow-primary/20">
                  <Clock className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Ativar Lembretes</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Para que você não esqueça de nenhuma tarefa, precisamos de sua permissão para enviar notificações.
                </p>
              </div>

              <div className="space-y-6 mb-10">
                <div className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                    <span className="text-primary font-black">1</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Clique no botão abaixo para solicitar a permissão.</p>
                </div>
                <div className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                    <span className="text-primary font-black">2</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Se o seu navegador perguntar, selecione <strong>"Permitir"</strong>.</p>
                </div>
                <div className="flex items-start gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                    <span className="text-primary font-black">3</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">No celular, verifique se as notificações do navegador estão ativadas nas configurações do sistema.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={requestNotificationPermission}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  Permitir Notificações
                </button>
                <button 
                  onClick={() => setShowNotificationPrompt(false)}
                  className="w-full py-4 text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                >
                  Agora Não
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-componentes
interface SidebarIconButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const SidebarIconButton: React.FC<SidebarIconButtonProps> = React.memo(({ active, onClick, icon, label, badge }) => (
  <button 
    onClick={onClick}
    title={label}
    className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all relative group ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary dark:hover:text-primary'}`}
  >
    {icon}
    {badge !== undefined && (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
        {badge}
      </span>
    )}
    {!active && (
      <span className="absolute left-full ml-4 px-3 py-1 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label}
      </span>
    )}
  </button>
));

interface SidebarMobileLinkProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

const SidebarMobileLink: React.FC<SidebarMobileLinkProps> = React.memo(({ active, onClick, icon, label, badge }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-5 p-5 rounded-2xl transition-all font-black text-lg relative ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
  >
    {icon}
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && (
      <span className="bg-primary text-white text-xs px-2 py-1 rounded-lg">
        {badge}
      </span>
    )}
  </button>
));

interface BentoCategorySectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  completions: TaskCompletion[];
  reminders: Reminder[];
  onToggle: (id: string) => Promise<void>;
  onUpdateReminder: (taskId: string, time: string, enabled: boolean) => Promise<void>;
  onDeleteCustomTask?: (id: string) => Promise<void>;
  currentDate: Date;
}

const BentoCategorySection: React.FC<BentoCategorySectionProps> = React.memo(({ title, icon, tasks, completions, reminders, onToggle, onUpdateReminder, onDeleteCustomTask, currentDate }) => {
  const todayStr = format(currentDate, 'yyyy-MM-dd');
  return (
    <div className="space-y-8" id={`section-${title}`}>
      <div className="flex items-center gap-3 md:gap-5">
        <div className="w-10 h-10 md:w-14 md:h-14 bg-white dark:bg-slate-900 rounded-xl md:rounded-[20px] flex items-center justify-center text-primary shadow-sm border border-slate-200/50 dark:border-slate-800/50">
          {icon}
        </div>
        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {tasks.map((task, idx) => (
          <BentoTaskItem 
            key={task.id} 
            task={task} 
            completed={completions.some(c => c.taskId === task.id && c.date === todayStr)} 
            reminder={reminders.find(r => r.taskId === task.id)}
            onToggle={onToggle} 
            onUpdateReminder={onUpdateReminder}
            onDeleteCustomTask={onDeleteCustomTask}
            delay={idx * 0.05}
            currentDate={currentDate}
          />
        ))}
      </div>
    </div>
  );
});

interface BentoTaskItemProps {
  task: Task;
  completed: boolean;
  reminder?: Reminder;
  onToggle: (id: string) => void | Promise<void>;
  onUpdateReminder: (taskId: string, time: string, enabled: boolean) => Promise<void>;
  onDeleteCustomTask?: (id: string) => Promise<void>;
  delay: number;
  currentDate: Date;
}

const BentoTaskItem: React.FC<BentoTaskItemProps> = React.memo(({ task, completed, reminder, onToggle, onUpdateReminder, onDeleteCustomTask, delay, currentDate }) => {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(reminder?.time || '07:00');

  useEffect(() => {
    if (reminder?.time) setTempTime(reminder.time);
  }, [reminder?.time]);

  const handleToggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onToggle(task.id);
  }, [onToggle, task.id]);

  const handleUpdateReminder = useCallback((time: string, enabled: boolean) => {
    onUpdateReminder(task.id, time, enabled);
  }, [onUpdateReminder, task.id]);

  const getRecurrenceText = () => {
    if (task.isWeatherSuggestion) return 'Sugestão Baseada no Clima';
    switch (task.frequency) {
      case 'daily': return 'Diário';
      case 'weekly': {
        const dayDiff = (task.dayOfWeek! - getDay(currentDate));
        const targetDate = new Date(currentDate.getTime() + dayDiff * 86400000);
        return `Semanal • ${format(targetDate, 'EEEE', { locale: ptBR })}`;
      }
      case 'biweekly': return 'Quinzenal • Dias 1 e 15';
      case 'monthly': return `Mensal • Dia ${task.dayOfMonth}`;
      case 'yearly': return 'Anual';
      default: return '';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={!completed ? { 
        y: -8, 
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
        borderColor: "var(--primary-color)"
      } : {}}
      whileTap={{ scale: 0.98 }}
      className={`group cursor-pointer p-6 md:p-8 rounded-[24px] md:rounded-[32px] border transition-all duration-500 flex flex-col justify-between h-56 md:h-64 ${completed ? 'bg-slate-100 dark:bg-slate-800 border-transparent opacity-50' : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/50 shadow-sm'} ${task.isWeatherSuggestion ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10' : ''}`}
    >
      <div className="flex justify-between items-start">
        <div 
          onClick={handleToggle}
          className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-500 ${completed ? 'bg-green-500 border-green-500' : 'border-slate-200 dark:border-slate-700 group-hover:border-primary group-hover:bg-primary/10'}`}
        >
          {completed && <CheckCircle2 className="w-6 h-6 text-white" />}
          {!completed && task.isWeatherSuggestion && <CloudSun className="w-5 h-5 text-amber-500" />}
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${completed ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400' : task.isWeatherSuggestion ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>
            {task.category}
          </div>
          {task.isCustom && !completed && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCustomTask?.(task.id);
              }}
              className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div onClick={handleToggle}>
        <h4 className={`text-xl font-black leading-tight mb-2 transition-all ${completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>{task.title}</h4>
        <p className={`text-xs font-bold uppercase tracking-widest ${completed ? 'text-slate-400 dark:text-slate-500' : task.isWeatherSuggestion ? 'text-amber-500' : 'text-primary'}`}>{getRecurrenceText()}</p>
      </div>

      {!completed && !task.isWeatherSuggestion && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowTimePicker(true);
              }}
              className={`flex items-center gap-2 transition-all p-2 rounded-xl ${reminder?.enabled ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-primary'}`}
            >
              <Clock className="w-4 h-4" />
              {showTimePicker ? (
                <input 
                  type="time" 
                  value={tempTime}
                  onChange={(e) => setTempTime(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateReminder(tempTime, true);
                      setShowTimePicker(false);
                    }
                    if (e.key === 'Escape') {
                      setShowTimePicker(false);
                    }
                  }}
                  onBlur={() => {
                    handleUpdateReminder(tempTime, true);
                    setShowTimePicker(false);
                  }}
                  className="text-xs font-bold text-primary bg-transparent focus:outline-none w-16"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-xs font-bold">
                  {reminder?.enabled ? reminder.time : 'Lembrete'}
                </span>
              )}
            </button>
          </div>
          
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUpdateReminder(reminder?.time || '07:00', !reminder?.enabled);
            }}
            className={`w-10 h-5 rounded-full transition-all relative ${reminder?.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${reminder?.enabled ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>
      )}
    </motion.div>
  );
});
