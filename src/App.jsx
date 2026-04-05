import { useEffect, useMemo, useRef, useState } from 'react';
import { localTracks } from './data';
import { adminEmail, extractStoragePath, isAdminUser, loadTracks, supabase } from './supabase';

const screens = [
  { id: 'discover', label: 'Discover' },
  { id: 'search', label: 'Search' },
  { id: 'library', label: 'Library' },
  { id: 'account', label: 'Account' },
  { id: 'admin', label: 'Admin' },
];

const logoSrc = '/branding/vibin-logo.png';
const categoryChips = ['chill', 'hype', 'focus', 'late night', 'soft pop'];
const recentSearches = ['wishes', 'midnight drive', 'pink skies'];

function IconButton({ children, ...props }) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M18 6 9 12l9 6V6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M6 6 15 12l-9 6V6Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 5.5h8A2.5 2.5 0 0 1 18.5 8v5A2.5 2.5 0 0 1 16 15.5H13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 13.5 10 16h4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 16v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 10h3l4-4v12l-4-4H5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.5a4 4 0 0 1 0 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18.5 7a7.5 7.5 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatAddedDate(value, index = 0) {
  const fallback = new Date(2025, 6, 30 + index);
  const date = value ? new Date(value) : fallback;

  if (Number.isNaN(date.getTime())) {
    return 'Recently added';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function App() {
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const waveformFrameRef = useRef(null);
  const [trackList, setTrackList] = useState(localTracks);
  const [activeScreen, setActiveScreen] = useState('discover');
  const [query, setQuery] = useState('');
  const [currentTrackId, setCurrentTrackId] = useState(localTracks[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [trackDurations, setTrackDurations] = useState({});
  const [waveformBars, setWaveformBars] = useState(() => Array.from({ length: 28 }, () => 8));
  const [statusMessage, setStatusMessage] = useState('Loading your library...');
  const [showSplash, setShowSplash] = useState(true);
  const [adminForm, setAdminForm] = useState({
    title: '',
    artist: '',
    blurb: '',
    audioFile: null,
    coverFile: null,
  });
  const [adminStatus, setAdminStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authStatus, setAuthStatus] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState('');
  const [editForm, setEditForm] = useState({
    title: '',
    artist: '',
    blurb: '',
    coverFile: null,
  });
  const [editStatus, setEditStatus] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isAdmin = isAdminUser(sessionUser);
  const navScreens = screens.filter((screen) => screen.id !== 'admin' || isAdmin);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrateTracks() {
      const nextTracks = await loadTracks();
      if (!isMounted || !nextTracks.length) {
        return;
      }

      setTrackList(nextTracks);
      setCurrentTrackId((currentValue) =>
        nextTracks.some((track) => track.id === currentValue) ? currentValue : nextTracks[0].id,
      );
      setStatusMessage(
        nextTracks === localTracks
          ? 'Showing your local library. Supabase sync will take over once the songs table has rows.'
          : 'Streaming your library from Supabase.',
      );
    }

    hydrateTracks();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    async function bootstrapAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSessionUser(session?.user ?? null);
    }

    bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setSessionUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshTracks() {
    const nextTracks = await loadTracks();
    if (!nextTracks.length) {
      return;
    }

    setTrackList(nextTracks);
    setCurrentTrackId((currentValue) =>
      nextTracks.some((track) => track.id === currentValue) ? currentValue : nextTracks[0].id,
    );
    setStatusMessage(
      nextTracks === localTracks
        ? 'Showing your local library. Supabase sync will take over once the songs table has rows.'
        : 'Streaming your library from Supabase.',
    );
  }

  const currentTrack = useMemo(
    () => trackList.find((track) => track.id === currentTrackId) ?? trackList[0] ?? null,
    [currentTrackId, trackList],
  );

  const filteredTracks = useMemo(() => {
    if (!query.trim()) {
      return trackList;
    }

    const normalized = query.trim().toLowerCase();
    return trackList.filter((track) =>
      `${track.title} ${track.artist} ${track.blurb}`.toLowerCase().includes(normalized),
    );
  }, [query, trackList]);

  useEffect(() => {
    setProgress(0);
  }, [currentTrackId]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateDurations() {
      const nextEntries = await Promise.all(
        trackList.map(
          (track) =>
            new Promise((resolve) => {
              if (track.duration > 0) {
                resolve([track.id, track.duration]);
                return;
              }

              const probe = new Audio();
              probe.preload = 'metadata';
              probe.src = track.src;

              const finalize = (value) => {
                probe.removeAttribute('src');
                probe.load();
                resolve([track.id, value]);
              };

              probe.addEventListener('loadedmetadata', () => finalize(probe.duration || 0), { once: true });
              probe.addEventListener('error', () => finalize(0), { once: true });
            }),
        ),
      );

      if (isCancelled) {
        return;
      }

      setTrackDurations(Object.fromEntries(nextEntries));
    }

    hydrateDurations();

    return () => {
      isCancelled = true;
    };
  }, [trackList]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const handleTimeUpdate = () => setProgress(audio.currentTime);
    const handleLoadedMetadata = () => {
      const nextDuration = audio.duration || 0;
      setDuration(nextDuration);
      setTrackDurations((currentValue) => ({
        ...currentValue,
        [currentTrackId]: nextDuration || currentValue[currentTrackId] || 0,
      }));
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      audio.currentTime = 0;
      stopWaveformLoop();
      setWaveformBars(Array.from({ length: 28 }, () => 8));
    };
    const handlePause = () => {
      stopWaveformLoop();
      setWaveformBars(Array.from({ length: 28 }, () => 8));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
    };
  }, [currentTrackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) {
      return;
    }

    audio.pause();
    audio.load();
    setIsPlaying(false);
    setProgress(0);
    setDuration(trackDurations[currentTrack.id] || currentTrack.duration || 0);
    stopWaveformLoop();
    setWaveformBars(Array.from({ length: 28 }, () => 8));
  }, [currentTrack?.src, trackDurations]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.loop = isLooping;
  }, [isLooping]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: 'vibin',
        artwork: [
          { src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' },
          { src: logoSrc, sizes: '768x768', type: 'image/png' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => {
        handleTogglePlayback();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        handleTogglePlayback();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        handleStep(-1);
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleStep(1);
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        handleSkip(-5);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        handleSkip(5);
      });
    }

    if ('audioSession' in navigator && navigator.audioSession) {
      try {
        navigator.audioSession.type = 'playback';
      } catch {
        return;
      }
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  function stopWaveformLoop() {
    if (waveformFrameRef.current) {
      window.cancelAnimationFrame(waveformFrameRef.current);
      waveformFrameRef.current = null;
    }
  }

  async function ensureVisualizer() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        return;
      }

      audioContextRef.current = new AudioCtx();
    }

    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.82;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
    }

    if (!sourceNodeRef.current) {
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audio);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }

  function startWaveformLoop() {
    if (!analyserRef.current || !dataArrayRef.current) {
      return;
    }

    stopWaveformLoop();

    const draw = () => {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const step = Math.max(1, Math.floor(dataArrayRef.current.length / 28));
      const nextBars = Array.from({ length: 28 }, (_, index) => {
        const value = dataArrayRef.current[index * step] ?? 0;
        return 8 + Math.round((value / 255) * 32);
      });
      setWaveformBars(nextBars);
      waveformFrameRef.current = window.requestAnimationFrame(draw);
    };

    draw();
  }

  async function handlePlayTrack(trackId) {
    const selectedTrack = trackList.find((track) => track.id === trackId);
    if (!selectedTrack) {
      return;
    }

    setCurrentTrackId(trackId);
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    await ensureVisualizer();

    if (currentTrackId !== trackId) {
      window.setTimeout(async () => {
        const nextAudio = audioRef.current;
        if (!nextAudio) {
          return;
        }

        nextAudio.currentTime = 0;
        await nextAudio.play();
        setIsPlaying(true);
        startWaveformLoop();
      }, 0);
      return;
    }

    audio.currentTime = 0;
    await audio.play();
    setIsPlaying(true);
    startWaveformLoop();
  }

  async function handleTogglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!isPlaying) {
      await ensureVisualizer();
      await audio.play();
      setIsPlaying(true);
      startWaveformLoop();
      return;
    }

    audio.pause();
    setIsPlaying(false);
    stopWaveformLoop();
  }

  async function handleStep(direction) {
    if (!currentTrack) {
      return;
    }

    const currentIndex = trackList.findIndex((track) => track.id === currentTrack.id);
    const nextIndex = (currentIndex + direction + trackList.length) % trackList.length;
    const nextTrack = trackList[nextIndex];
    setCurrentTrackId(nextTrack.id);

    window.setTimeout(async () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      await ensureVisualizer();
      audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
      startWaveformLoop();
    }, 0);
  }

  function handleSeek(event) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const nextProgress = Math.max(0, Math.min(ratio, 1)) * duration;
    setProgress(nextProgress);
    audio.currentTime = nextProgress;
  }

  function handleSkip(seconds) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const maxDuration = duration || audio.duration || 0;
    const nextProgress = Math.max(0, Math.min(audio.currentTime + seconds, maxDuration));
    audio.currentTime = nextProgress;
    setProgress(nextProgress);
  }

  function handleToggleLoop() {
    setIsLooping((value) => !value);
  }

  function handleVolumeChange(event) {
    setVolume(Number(event.target.value));
  }

  function getTrackDuration(track) {
    return trackDurations[track.id] || track.duration || 0;
  }

  function renderSongRows(mode = 'search') {
    const tracks = mode === 'search' ? filteredTracks : trackList;

    return (
      <div className="song-table">
        <div className="song-table__header">
          <span>#</span>
          <span>Title</span>
          <span>Album</span>
          <span>Date added</span>
          <span>Duration</span>
          <span className="song-table__actions-heading">Actions</span>
        </div>

        <div className="song-table__body">
          {tracks.map((track, index) => {
            const isActive = track.id === currentTrack?.id;
            const resolvedDuration = getTrackDuration(track);

            return (
              <article
                className={isActive ? 'song-row is-active' : 'song-row'}
                key={track.id}
                onClick={() => handlePlayTrack(track.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePlayTrack(track.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span className="song-row__index">{index + 1}</span>
                <div className="song-row__title">
                  <img src={track.cover} alt={`${track.title} cover art`} />
                  <div>
                    <strong>{track.title}</strong>
                    <span>{track.artist}</span>
                  </div>
                </div>
                <p className="song-row__album">{track.album || track.title}</p>
                <p className="song-row__date">{formatAddedDate(track.addedAt, index)}</p>
                <span className="song-row__duration">{formatTime(isActive ? duration || resolvedDuration : resolvedDuration)}</span>
                <div className="song-row__actions">
                  <span className={isActive ? 'song-row__badge is-visible' : 'song-row__badge'}>{isPlaying && isActive ? 'Playing' : 'Ready'}</span>
                  {mode === 'library' && isAdmin ? (
                    <>
                      <button
                        type="button"
                        className="table-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditingTrack(track);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table-action table-action--danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteTrack(track);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function handleAdminFieldChange(event) {
    const { name, value } = event.target;
    setAdminForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }));
  }

  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setAuthStatus('Supabase is not configured in this app yet.');
      return;
    }

    if (!authForm.email || !authForm.password) {
      setAuthStatus('Enter your email and password first.');
      return;
    }

    setIsAuthenticating(true);
    setAuthStatus(authMode === 'signin' ? 'Signing you in...' : 'Creating your account...');

    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });

      setAuthStatus(error ? `Login failed: ${error.message}` : 'Signed in successfully.');
      setIsAuthenticating(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
    });

    setAuthStatus(
      error
        ? `Sign up failed: ${error.message}`
        : 'Account created. If email confirmation is on in Supabase, confirm your email before signing in.',
    );
    setIsAuthenticating(false);
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAuthStatus('Signed out successfully.');
    setEditingTrackId('');
    setActiveScreen('discover');
  }

  function handleAdminFileChange(event) {
    const { name, files } = event.target;
    setAdminForm((currentValue) => ({
      ...currentValue,
      [name]: files?.[0] ?? null,
    }));
  }

  async function handleAdminSubmit(event) {
    event.preventDefault();

    if (!supabase) {
      setAdminStatus('Supabase is not configured in this app yet.');
      return;
    }

    if (!isAdmin) {
      setAdminStatus('Only the admin account can upload songs.');
      return;
    }

    if (!adminForm.title || !adminForm.audioFile || !adminForm.coverFile) {
      setAdminStatus('Add a title, an MP3 file, and a cover image first.');
      return;
    }

    const trackId = slugify(adminForm.title);
    if (!trackId) {
      setAdminStatus('Use a title with letters or numbers so I can generate an ID.');
      return;
    }

    setIsSubmitting(true);
    setAdminStatus('Uploading files to Supabase...');

    try {
      const audioExtension = adminForm.audioFile.name.split('.').pop() || 'mp3';
      const coverExtension = adminForm.coverFile.name.split('.').pop() || 'jpg';
      const audioPath = `${trackId}.${audioExtension}`;
      const coverPath = `${trackId}.${coverExtension}`;

      const { error: audioError } = await supabase.storage
        .from('song-files')
        .upload(audioPath, adminForm.audioFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: adminForm.audioFile.type || 'audio/mpeg',
        });

      if (audioError) {
        throw audioError;
      }

      const { error: coverError } = await supabase.storage
        .from('cover-images')
        .upload(coverPath, adminForm.coverFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: adminForm.coverFile.type || 'image/jpeg',
        });

      if (coverError) {
        throw coverError;
      }

      const { data: audioUrlData } = supabase.storage.from('song-files').getPublicUrl(audioPath);
      const { data: coverUrlData } = supabase.storage.from('cover-images').getPublicUrl(coverPath);

      const { error: insertError } = await supabase.from('songs').upsert({
        id: trackId,
        title: adminForm.title,
        artist: adminForm.artist || 'Personal Track',
        blurb: adminForm.blurb || 'A track from your collection.',
        cover_url: coverUrlData.publicUrl,
        audio_url: audioUrlData.publicUrl,
      });

      if (insertError) {
        throw insertError;
      }

      setAdminForm({
        title: '',
        artist: '',
        blurb: '',
        audioFile: null,
        coverFile: null,
      });
      event.target.reset();
      await refreshTracks();
      setAdminStatus('Song uploaded successfully. Refreshing your library now.');
    } catch (error) {
      setAdminStatus(`Upload failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditingTrack(track) {
    setEditingTrackId(track.id);
    setEditForm({
      title: track.title,
      artist: track.artist,
      blurb: track.blurb,
      coverFile: null,
    });
    setEditStatus('');
  }

  function handleEditFieldChange(event) {
    const { name, value } = event.target;
    setEditForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }));
  }

  function handleEditFileChange(event) {
    setEditForm((currentValue) => ({
      ...currentValue,
      coverFile: event.target.files?.[0] ?? null,
    }));
  }

  async function handleSaveEdit(track) {
    if (!supabase || !isAdmin) {
      setEditStatus('Only the admin account can edit songs.');
      return;
    }

    setIsSavingEdit(true);
    setEditStatus('Saving changes...');

    try {
      let nextCoverUrl = track.cover;

      if (editForm.coverFile) {
        const coverExtension = editForm.coverFile.name.split('.').pop() || 'jpg';
        const coverPath = `${track.id}.${coverExtension}`;
        const { error: coverError } = await supabase.storage
          .from('cover-images')
          .upload(coverPath, editForm.coverFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: editForm.coverFile.type || 'image/jpeg',
          });
        if (coverError) throw coverError;
        const { data: coverUrlData } = supabase.storage.from('cover-images').getPublicUrl(coverPath);
        nextCoverUrl = coverUrlData.publicUrl;
      }

      const { error } = await supabase
        .from('songs')
        .update({
          title: editForm.title,
          artist: editForm.artist,
          blurb: editForm.blurb,
          cover_url: nextCoverUrl,
        })
        .eq('id', track.id);

      if (error) throw error;

      await refreshTracks();
      setEditStatus('Song updated successfully.');
      setEditingTrackId('');
    } catch (error) {
      setEditStatus(`Update failed: ${error.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteTrack(track) {
    if (!supabase || !isAdmin) {
      return;
    }

    const shouldDelete = window.confirm(`Delete "${track.title}" from the library?`);
    if (!shouldDelete) {
      return;
    }

    setEditStatus('Deleting song...');

    try {
      const audioPath = extractStoragePath(track.src);
      const coverPath = extractStoragePath(track.cover);

      const { error: deleteRowError } = await supabase.from('songs').delete().eq('id', track.id);
      if (deleteRowError) throw deleteRowError;

      if (audioPath) {
        await supabase.storage.from('song-files').remove([audioPath]);
      }

      if (coverPath) {
        await supabase.storage.from('cover-images').remove([coverPath]);
      }

      await refreshTracks();
      setEditStatus('Song deleted successfully.');
    } catch (error) {
      setEditStatus(`Delete failed: ${error.message}`);
    }
  }

  function renderDiscover() {
    return (
      <>
        <header className="hero vibin-hero">
          <div className="hero-copy">
            <p className="eyebrow">good evening</p>
            <h1>your vibe, on repeat.</h1>
            <p>
              vibin blends premium minimalism with a smooth listening flow. clean cards, soft motion, and
              just enough color to keep everything feeling alive.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="primary"
                onClick={() => currentTrack && handlePlayTrack(currentTrack.id)}
                disabled={!currentTrack}
              >
                Play track
              </button>
              <button type="button" className="secondary" onClick={() => setActiveScreen('library')}>
                open library
              </button>
            </div>
            <p className="status-copy">{statusMessage}</p>
          </div>

          <div className="hero-stack">
            <div className="brand-float">
              <img src={logoSrc} alt="vibin logo" className="brand-logo" />
            </div>
            {currentTrack ? (
              <button
                type="button"
                className="hero-art"
                onClick={() => handlePlayTrack(currentTrack.id)}
                style={{ backgroundImage: `url(${currentTrack.cover})` }}
              >
                <span>now spinning</span>
                <strong>{currentTrack.title}</strong>
                <em>{currentTrack.artist}</em>
              </button>
            ) : null}
          </div>
        </header>

        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">recently played</p>
              <h2>jump back in</h2>
            </div>
          </div>
          <div className="card-grid rail-grid">
            {trackList.map((track) => (
              <button
                type="button"
                className="media-card"
                key={track.id}
                onClick={() => handlePlayTrack(track.id)}
              >
                <img src={track.cover} alt={`${track.title} cover art`} />
                <h3>{track.title}</h3>
                <p>{track.blurb}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">trending</p>
              <h2>made for late nights</h2>
            </div>
          </div>
          <div className="mini-grid">
            {trackList.slice(0, 3).map((track, index) => (
              <button type="button" className="mini-card" key={`${track.id}-trend`} onClick={() => handlePlayTrack(track.id)}>
                <span className="mini-index">0{index + 1}</span>
                <div>
                  <strong>{track.title}</strong>
                  <p>{track.artist}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderSearch() {
    return (
      <section className="section section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">search</p>
            <h2>find your next mood</h2>
          </div>
        </div>
        <label className="search-shell">
          <span>search</span>
          <input
            type="search"
            placeholder="try artist, title, or mood"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chip-row">
          {categoryChips.map((chip) => (
            <button type="button" className="chip" key={chip}>
              {chip}
            </button>
          ))}
        </div>
        <div className="recent-row">
          <p className="eyebrow">recent searches</p>
          <div className="recent-list">
            {recentSearches.map((item) => (
              <span className="recent-pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
        {renderSongRows('search')}
      </section>
    );
  }

  function renderLibrary() {
    return (
      <section className="section section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">library</p>
            <h2>your essentials</h2>
          </div>
          {isAdmin ? <p className="inline-note">Admin mode: edit and delete controls are live.</p> : null}
        </div>
        <div className="library-stats">
          <div className="stat-card">
            <span>liked songs</span>
            <strong>{trackList.length}</strong>
          </div>
          <div className="stat-card">
            <span>downloads</span>
            <strong>{trackList.length}</strong>
          </div>
          <div className="stat-card">
            <span>playlists</span>
            <strong>03</strong>
          </div>
        </div>
        {editStatus ? <p className="inline-note">{editStatus}</p> : null}
        {editingTrackId ? (
          <article className="account-card edit-drawer">
            <div className="section-heading">
              <div>
                <p className="eyebrow">edit track</p>
                <h2>{editForm.title || 'Selected track'}</h2>
              </div>
            </div>
            <div className="edit-stack">
              <input name="title" value={editForm.title} onChange={handleEditFieldChange} />
              <input name="artist" value={editForm.artist} onChange={handleEditFieldChange} />
              <textarea name="blurb" rows="3" value={editForm.blurb} onChange={handleEditFieldChange} />
              <input type="file" accept="image/*" onChange={handleEditFileChange} />
              <div className="card-actions">
                <button
                  type="button"
                  onClick={() => {
                    const track = trackList.find((item) => item.id === editingTrackId);
                    if (track) {
                      handleSaveEdit(track);
                    }
                  }}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="ghost-button" onClick={() => setEditingTrackId('')}>
                  Cancel
                </button>
              </div>
            </div>
          </article>
        ) : null}
        {renderSongRows('library')}
      </section>
    );
  }

  function renderAccount() {
    return (
      <section className="section section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h2>{sessionUser ? 'Your session' : authMode === 'signin' ? 'Sign in' : 'Create account'}</h2>
          </div>
        </div>

        {sessionUser ? (
          <div className="account-card">
            <p className="account-line">
              Signed in as <strong>{sessionUser.email}</strong>
            </p>
            <p className="account-line">
              Role: <strong>{isAdmin ? 'Admin' : 'Listener'}</strong>
            </p>
            <div className="card-actions">
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
              {isAdmin ? (
                <button type="button" className="ghost-button" onClick={() => setActiveScreen('admin')}>
                  Open admin
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <form className="admin-form auth-form" onSubmit={handleAuthSubmit}>
            <label className="field-group">
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={authForm.email}
                onChange={handleAuthFieldChange}
                placeholder="you@example.com"
              />
            </label>

            <label className="field-group">
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={authForm.password}
                onChange={handleAuthFieldChange}
                placeholder="At least 6 characters"
              />
            </label>

            <div className="field-full auth-switch">
              <button type="submit" className="primary upload-button" disabled={isAuthenticating}>
                {isAuthenticating ? 'Please wait...' : authMode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setAuthMode((mode) => (mode === 'signin' ? 'signup' : 'signin'));
                  setAuthStatus('');
                }}
              >
                {authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
              </button>
            </div>
            <p className="admin-status">
              {authStatus ||
                (adminEmail
                  ? 'Admin tools are reserved for the owner account. All other accounts sign in as normal listeners.'
                  : 'Set VITE_ADMIN_EMAIL in the environment so the app knows which account is the admin.')}
            </p>
          </form>
        )}
      </section>
    );
  }

  function renderAdmin() {
    if (!isAdmin) {
      return (
        <section className="section section-stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Admin controls</p>
              <h2>Admin only</h2>
            </div>
          </div>
          <div className="account-card">
            <p className="account-line">Only the admin email can upload songs here.</p>
            <button type="button" onClick={() => setActiveScreen('account')}>
              Go to account
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="section section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin controls</p>
            <h2>Add a song</h2>
          </div>
        </div>

        <form className="admin-form" onSubmit={handleAdminSubmit}>
          <label className="field-group">
            <span>Song title</span>
            <input name="title" type="text" value={adminForm.title} onChange={handleAdminFieldChange} placeholder="Wishes" />
          </label>

          <label className="field-group">
            <span>Artist name</span>
            <input name="artist" type="text" value={adminForm.artist} onChange={handleAdminFieldChange} placeholder="Personal Track" />
          </label>

          <label className="field-group field-full">
            <span>Description</span>
            <textarea
              name="blurb"
              rows="4"
              value={adminForm.blurb}
              onChange={handleAdminFieldChange}
              placeholder="Short line about this song"
            />
          </label>

          <label className="field-group">
            <span>MP3 file</span>
            <input name="audioFile" type="file" accept=".mp3,audio/mpeg" onChange={handleAdminFileChange} />
          </label>

          <label className="field-group">
            <span>Cover image</span>
            <input name="coverFile" type="file" accept="image/*" onChange={handleAdminFileChange} />
          </label>

          <div className="field-full admin-actions">
            <button type="submit" className="primary upload-button" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Upload song'}
            </button>
            <p className="admin-status">{adminStatus || 'This sends the files to Supabase Storage and saves the track in the songs table.'}</p>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="app-shell">
      {currentTrack ? (
        <audio ref={audioRef} crossOrigin="anonymous">
          <source src={currentTrack.src} type="audio/mpeg" />
        </audio>
      ) : null}

      <aside className="sidebar">
        <div className="brand-block">
          <img src={logoSrc} alt="vibin logo" className="sidebar-logo" />
          <div>
            <p className="eyebrow">premium music app</p>
            <h2>vibin</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navScreens.map((screen) => (
            <button
              type="button"
              key={screen.id}
              className={activeScreen === screen.id ? 'active' : ''}
              onClick={() => setActiveScreen(screen.id)}
            >
              {screen.label}
            </button>
          ))}
        </nav>

        <section className="sidebar-card">
          <p className="eyebrow">your vibe</p>
          <h3>clean. smooth. minimal.</h3>
          <p>stream, search, save, and manage your music in a quieter, more premium shell.</p>
        </section>
      </aside>

      <main className="main-panel">
        {activeScreen === 'discover' && renderDiscover()}
        {activeScreen === 'search' && renderSearch()}
        {activeScreen === 'library' && renderLibrary()}
        {activeScreen === 'account' && renderAccount()}
        {activeScreen === 'admin' && renderAdmin()}
      </main>

      <footer className="player-bar">
        <div className="now-playing">
          {currentTrack ? <img src={currentTrack.cover} alt={`${currentTrack.title} cover art`} className="player-cover" /> : null}
          <div>
            <p className="track-title">{currentTrack?.title ?? 'No track loaded'}</p>
            <p className="track-meta">{currentTrack?.artist ?? 'Add songs in Supabase to start streaming'}</p>
          </div>
        </div>

        <div className="player-center">
          <div className="waveform" aria-hidden="true">
            {waveformBars.map((barHeight, index) => (
              <span
                key={index}
                style={{
                  height: `${barHeight}px`,
                }}
              />
            ))}
          </div>

          <div className="transport">
            <IconButton onClick={() => handleStep(-1)} aria-label="Previous track" className="icon-button" disabled={!currentTrack}>
              <PreviousIcon />
            </IconButton>
            <IconButton onClick={() => handleSkip(-5)} aria-label="Rewind five seconds" className="pill-button" disabled={!currentTrack}>
              -5s
            </IconButton>
            <IconButton className="play-button" onClick={handleTogglePlayback} aria-label="Toggle playback" disabled={!currentTrack}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            <IconButton onClick={() => handleSkip(5)} aria-label="Fast forward five seconds" className="pill-button" disabled={!currentTrack}>
              +5s
            </IconButton>
            <IconButton onClick={() => handleStep(1)} aria-label="Next track" className="icon-button" disabled={!currentTrack}>
              <NextIcon />
            </IconButton>
            <IconButton
              className={isLooping ? 'icon-button loop-button active' : 'icon-button loop-button'}
              onClick={handleToggleLoop}
              aria-label="Toggle loop"
              disabled={!currentTrack}
            >
              <RepeatIcon />
            </IconButton>
          </div>

          <div className="progress-wrap">
            <span>{formatTime(progress)}</span>
            <button type="button" className="progress-track" onClick={handleSeek} aria-label="Seek in track" disabled={!currentTrack}>
              <span className="progress-fill" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            </button>
            <span>{formatTime(duration || currentTrack?.duration || 0)}</span>
          </div>
        </div>

        <div className="player-tools">
          <VolumeIcon />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="volume-slider"
          />
        </div>
      </footer>

      {showSplash ? (
        <div className="splash-screen">
          <img src={logoSrc} alt="vibin logo" className="splash-logo" />
        </div>
      ) : null}
    </div>
  );
}

export default App;
