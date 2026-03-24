import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const authMessage = document.getElementById('auth-message');
const userPanel = document.getElementById('user-panel');
const userEmail = document.getElementById('user-email');
const signOutButton = document.getElementById('sign-out-button');

const wordCard = document.getElementById('word-card');
const wordsListCard = document.getElementById('words-list-card');
const wordForm = document.getElementById('word-form');
const saveMessage = document.getElementById('save-message');
const refreshButton = document.getElementById('refresh-button');
const wordsList = document.getElementById('words-list');

const ankiCard = document.getElementById('anki-card');
const testAnkiButton = document.getElementById('test-anki-button');
const loadDecksButton = document.getElementById('load-decks-button');
const uploadAnkiButton = document.getElementById('upload-anki-button');
const deckSelect = document.getElementById('deck-select');
const ankiMessage = document.getElementById('anki-message');

function setMessage(element, text, type = '') {
  element.textContent = text;
  element.className = 'message';
  if (type) {
    element.classList.add(type);
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function renderWords(words) {
  wordsList.innerHTML = '';

  if (!words.length) {
    const p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = 'No words saved yet.';
    wordsList.appendChild(p);
    return;
  }

  words.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'word-item';

    const title = document.createElement('h3');
    title.textContent = item.word;

    const translation = document.createElement('p');
    translation.className = 'word-meta';
    translation.innerHTML = `<strong>Translation:</strong> ${item.translation || '—'}`;

    const sentence = document.createElement('p');
    sentence.className = 'word-meta';
    sentence.innerHTML = `<strong>Sentence:</strong> ${item.sentence || '—'}`;

    const createdAt = document.createElement('p');
    createdAt.className = 'word-meta';
    createdAt.innerHTML = `<strong>Saved:</strong> ${formatDate(item.created_at)}`;

    const status = document.createElement('p');
    status.className = 'word-meta';
    status.innerHTML = `<strong>Status:</strong> ${item.uploaded ? 'Uploaded to Anki' : 'Not uploaded yet'}`;

    article.append(title, translation, sentence, createdAt, status);
    wordsList.appendChild(article);
  });
}

async function loadWords() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    renderWords([]);
    return;
  }

  const { data, error } = await supabase
    .from('words')
    .select('id, word, translation, sentence, created_at, uploaded')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    setMessage(saveMessage, error.message, 'error');
    return;
  }

  renderWords(data ?? []);
}

async function updateAuthUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const signedIn = Boolean(session?.user);

  if (signedIn) {
    loginForm.classList.add('hidden');
    userPanel.classList.remove('hidden');
    wordCard.classList.remove('hidden');
    wordsListCard.classList.remove('hidden');
    ankiCard.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    await loadWords();
  } else {
    loginForm.classList.remove('hidden');
    userPanel.classList.add('hidden');
    wordCard.classList.add('hidden');
    wordsListCard.classList.add('hidden');
    ankiCard.classList.add('hidden');
    wordsList.innerHTML = '';
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(authMessage, '');

  const email = emailInput.value.trim();
  if (!email) {
    setMessage(authMessage, 'Enter your email address.', 'error');
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });

  if (error) {
    setMessage(authMessage, error.message, 'error');
    return;
  }

  setMessage(authMessage, 'Magic link sent. Open your email on this device and click the link.', 'success');
  loginForm.reset();
});

signOutButton.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    setMessage(authMessage, error.message, 'error');
    return;
  }
  setMessage(authMessage, 'Signed out.', 'success');
  await updateAuthUI();
});

wordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(saveMessage, '');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    setMessage(saveMessage, 'You are not signed in.', 'error');
    return;
  }

  const formData = new FormData(wordForm);
  const word = String(formData.get('word') || '').trim();
  const translation = String(formData.get('translation') || '').trim();
  const sentence = String(formData.get('sentence') || '').trim();

  if (!word) {
    setMessage(saveMessage, 'Word is required.', 'error');
    return;
  }

  const { error } = await supabase.from('words').insert({
    user_id: user.id,
    word,
    translation,
    sentence,
  });

  if (error) {
    setMessage(saveMessage, error.message, 'error');
    return;
  }

  wordForm.reset();
  setMessage(saveMessage, 'Word saved.', 'success');
  await loadWords();
});

refreshButton.addEventListener('click', async () => {
  await loadWords();
});

supabase.auth.onAuthStateChange(async () => {
  await updateAuthUI();
});
async function callAnki(action, params = {}) {
  const response = await fetch('http://localhost:8765', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      version: 6,
      params,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data.result;
}
testAnkiButton.addEventListener('click', async () => {
  setMessage(ankiMessage, '');

  try {
    const version = await callAnki('version');
    setMessage(ankiMessage, `Anki connected. API version: ${version}`, 'success');
  } catch (error) {
    setMessage(
        ankiMessage,
        'Could not connect to Anki. Make sure Anki is open and AnkiConnect is installed.',
        'error'
    );
  }
});
async function loadAnkiDecks() {
  const decks = await callAnki('deckNames');

  deckSelect.innerHTML = '<option value="">Choose a deck</option>';

  decks.forEach((deck) => {
    const option = document.createElement('option');
    option.value = deck;
    option.textContent = deck;
    deckSelect.appendChild(option);
  });
}
loadDecksButton.addEventListener('click', async () => {
  setMessage(ankiMessage, '');

  try {
    await loadAnkiDecks();
    setMessage(ankiMessage, 'Decks loaded.', 'success');
  } catch (error) {
    setMessage(ankiMessage, error.message, 'error');
  }
});
async function uploadWordsToAnki() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('You are not signed in.');
  }

  const deckName = deckSelect.value;
  if (!deckName) {
    throw new Error('Choose a deck first.');
  }

  const { data: words, error } = await supabase
      .from('words')
      .select('id, word, translation, sentence')
      .eq('user_id', user.id)
      .eq('uploaded', false)
      .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!words || !words.length) {
    throw new Error('No saved words to upload.');
  }

  const notes = words.map((item) => ({
    deckName,
    modelName: 'Basic',
    fields: {
      Front: item.word,
      Back: `
        ${item.translation || ''}
        <br><br>
        ${item.sentence || ''}
      `,
    },
    tags: ['german-vocab'],
  }));
  const result = await callAnki('addNotes', { notes });
  const uploadedIds = words
      .filter((_, index) => result[index] !== null)
      .map((item) => item.id);

  if (uploadedIds.length > 0) {
    const { error: updateError } = await supabase
        .from('words')
        .update({ uploaded: true })
        .in('id', uploadedIds);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }
  return {
    uploadedCount: uploadedIds.length,
    totalCount: words.length,
  };
}
uploadAnkiButton.addEventListener('click', async () => {
  setMessage(ankiMessage, '');

  try {
    const result = await uploadWordsToAnki();
    await loadWords();

    if (result.uploadedCount === 0) {
      setMessage(ankiMessage, 'No new words were uploaded.', 'error');
      return;
    }

    setMessage(
        ankiMessage,
        `Uploaded ${result.uploadedCount} of ${result.totalCount} new word(s) to Anki.`,
        'success'
    );
  } catch (error) {
    setMessage(ankiMessage, error.message, 'error');
  }
});
updateAuthUI();
