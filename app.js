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
const searchWordInput = document.getElementById('search-word');
const searchResults = document.getElementById('search-results');
const searchMessage = document.getElementById('search-message');
const saveMessage = document.getElementById('save-message');
const refreshButton = document.getElementById('refresh-button');
const wordsList = document.getElementById('words-list');

const wordSheet = document.getElementById('word-sheet');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const closeSheetButton = document.getElementById('close-sheet-button');
const sheetWordTitle = document.getElementById('sheet-word-title');
const sheetStatus = document.getElementById('sheet-status');
const senseList = document.getElementById('sense-list');
const sentenceList = document.getElementById('sentence-list');
const saveSelectedButton = document.getElementById('save-selected-button');

const ankiCard = document.getElementById('anki-card');
const testAnkiButton = document.getElementById('test-anki-button');
const loadDecksButton = document.getElementById('load-decks-button');
const uploadAnkiButton = document.getElementById('upload-anki-button');
const deckSelect = document.getElementById('deck-select');
const ankiMessage = document.getElementById('anki-message');

let searchTimer = null;
let currentEntry = null;
let selectedSense = null;
let selectedSentence = null;
let fallbackSentences = [];
let latestSearchToken = 0;

function setMessage(element, text, type = '') {
  const isCompact = element.id === 'sheet-status';
  element.textContent = text;
  element.className = 'message';
  if (isCompact) {
    element.classList.add('compact-message');
  }
  if (type) {
    element.classList.add(type);
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
}
function htmlToPlainText(input) {
  const firstPass = new DOMParser()
      .parseFromString(String(input ?? ''), 'text/html')
      .body.textContent || '';

  const secondPass = new DOMParser()
      .parseFromString(firstPass, 'text/html')
      .body.textContent || firstPass;

  return secondPass.replace(/\s+/g, ' ').trim();
}
function cleanDefinitionText(value) {
  return String(value ?? '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function openSheet() {
  wordSheet.classList.remove('hidden');
  wordSheet.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSheet() {
  wordSheet.classList.add('hidden');
  wordSheet.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  currentEntry = null;
  selectedSense = null;
  selectedSentence = null;
  fallbackSentences = [];
  setMessage(saveMessage, '');
  setMessage(sheetStatus, '');
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
    translation.innerHTML = `<strong>Meaning:</strong> ${escapeHtml(item.translation || '—')}`;

    const pos = document.createElement('p');
    pos.className = 'word-meta';
    pos.innerHTML = `<strong>Part of speech:</strong> ${escapeHtml(item.pos || '—')}`;

    const sentence = document.createElement('p');
    sentence.className = 'word-meta';
    sentence.innerHTML = `<strong>Sentence:</strong> ${escapeHtml(htmlToPlainText(item.sentence || '—'))}`;

    const sentenceTranslation = document.createElement('p');
    sentenceTranslation.className = 'word-meta';
    sentenceTranslation.innerHTML = `<strong>Sentence translation:</strong> ${escapeHtml(htmlToPlainText(item.sentence_translation || '—'))}`;

    const createdAt = document.createElement('p');
    createdAt.className = 'word-meta';
    createdAt.innerHTML = `<strong>Saved:</strong> ${escapeHtml(formatDate(item.created_at))}`;

    const status = document.createElement('p');
    status.className = 'word-meta';
    status.innerHTML = `<strong>Status:</strong> ${item.uploaded ? 'Uploaded to Anki' : 'Not uploaded yet'}`;

    const actions = document.createElement('div');
    actions.className = 'word-actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger-button';
    deleteButton.textContent = 'Delete';

    deleteButton.addEventListener('click', async () => {
      try {
        deleteButton.disabled = true;
        deleteButton.textContent = 'Deleting...';
        await deleteWord(item.id);
      } catch (error) {
        alert(`Could not delete word: ${error.message}`);
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete';
      }
    });

    actions.appendChild(deleteButton);

    article.append(
        title,
        translation,
        pos,
        sentence,
        sentenceTranslation,
        createdAt,
        status,
        actions
    );

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
      .select('id, word, translation, pos, sentence, sentence_translation, created_at, uploaded')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

  if (error) {
    setMessage(saveMessage, error.message, 'error');
    return;
  }

  renderWords(data ?? []);
}

async function updateAuthUI(session) {

  const signedIn = session ? Boolean(session?.user) : false;

  if (signedIn) {
    loginForm.classList.add('hidden');
    userPanel.classList.remove('hidden');
    wordCard.classList.remove('hidden');
    wordsListCard.classList.remove('hidden');
    userEmail.textContent = session.user.email;
    ankiCard.classList.remove('hidden');
    await loadWords();
  } else {
    loginForm.classList.remove('hidden');
    userPanel.classList.add('hidden');
    wordCard.classList.add('hidden');
    wordsListCard.classList.add('hidden');
    searchWordInput.value = '';
    searchResults.innerHTML = '';
    ankiCard.classList.add('hidden');
    searchResults.classList.add('hidden');
    wordsList.innerHTML = '';
  }
}

async function searchHeadwords(query) {
  const url = new URL('https://en.wiktionary.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('list', 'prefixsearch');
  url.searchParams.set('pssearch', query);
  url.searchParams.set('pslimit', '5');
  url.searchParams.set('origin', '*');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not search the dictionary.');
  }

  const data = await response.json();
  const items = data.query?.prefixsearch ?? [];

  return uniqueBy(
      items
          .map((item) => ({
            title: String(item.title || '').trim(),
          }))
          .filter((item) => item.title),
      (item) => item.title.toLowerCase()
  );
}

async function fetchWiktionaryDefinitions(word) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load dictionary meanings.');
  }

  return await response.json();
}

function normalizeSenses(word, payload) {
  const germanEntries = Array.isArray(payload?.de) ? payload.de : [];
  const senses = [];

  germanEntries.forEach((entry, entryIndex) => {
    const pos = cleanDefinitionText(entry.partOfSpeech || 'Other');
    const definitions = Array.isArray(entry.definitions) ? entry.definitions : [];

    definitions.forEach((definition, definitionIndex) => {
      const meaning = htmlToPlainText(cleanDefinitionText(definition.definition || ''));
      if (!meaning) {
        return;
      }

      const parsedExamples = Array.isArray(definition.parsedExamples) ? definition.parsedExamples : [];
      const examples = parsedExamples
          .map((item) => ({
            sentence: htmlToPlainText(cleanDefinitionText(item.example || '')),
            sentence_translation: htmlToPlainText(cleanDefinitionText(item.translation || '')),
            source: 'wiktionary',
          }))
          .filter((item) => item.sentence);

      senses.push({
        id: `${word}-${entryIndex}-${definitionIndex}`,
        word,
        pos,
        translation: meaning,
        sense: meaning,
        examples,
      });
    });
  });

  return uniqueBy(senses, (item) => `${item.pos}__${item.sense.toLowerCase()}`);
}

function extractTatoebaTranslation(item) {
  const translations = Array.isArray(item?.translations) ? item.translations : [];

  for (const group of translations) {
    if (Array.isArray(group)) {
      const english = group.find((entry) => entry.lang === 'eng' || entry.lang === 'en');
      if (english?.text) {
        return cleanDefinitionText(english.text);
      }
      if (group[0]?.text) {
        return cleanDefinitionText(group[0].text);
      }
    } else if (group?.text) {
      return cleanDefinitionText(group.text);
    }
  }

  return '';
}

async function fetchTatoebaSentences(word) {
  const url = new URL('https://api.tatoeba.org/v1/sentences');
  url.searchParams.set('lang', 'deu');
  url.searchParams.set('q', word);
  url.searchParams.set('trans:lang', 'eng');
  url.searchParams.set('showtrans', 'matching');
  url.searchParams.set('limit', '5');

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not load example sentences.');
  }

  const data = await response.json();
  const rows = Array.isArray(data?.data) ? data.data : [];

  return uniqueBy(
      rows
          .map((item) => ({
            sentence: cleanDefinitionText(item.text || ''),
            sentence_translation: extractTatoebaTranslation(item),
            source: 'tatoeba',
          }))
          .filter((item) => item.sentence),
      (item) => item.sentence.toLowerCase()
  );
}

function renderSearchResults(results) {
  searchResults.innerHTML = '';

  if (!results.length) {
    searchResults.classList.add('hidden');
    setMessage(searchMessage, 'No matching words found.');
    return;
  }

  results.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result-item';
    button.innerHTML = `<strong>${escapeHtml(item.title)}</strong><span>Tap to choose a meaning</span>`;
    button.addEventListener('click', () => openWordSheet(item.title));
    searchResults.appendChild(button);
  });

  searchResults.classList.remove('hidden');
}

function renderSentenceOptions(sentences) {


  if (!sentences.length) {
    selectedSentence = null;
    return;
  }

  sentences.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'choice-card';
    card.innerHTML = `
      <div><strong>DE:</strong> ${escapeHtml(htmlToPlainText(item.sentence))}</div>
      <div class="muted"><strong>EN:</strong> ${escapeHtml(htmlToPlainText(item.sentence_translation || 'No translation available'))}</div>
      <small>Source: ${escapeHtml(item.source)}</small>
    `;

    card.addEventListener('click', () => {
      card.classList.add('selected');
    });

    if (index === 0) {
      selectedSentence = item;
      card.classList.add('selected');
    }

    sentenceList.appendChild(card);
  });
}

function updateSentenceChoices() {
  if (!selectedSense) {
    renderSentenceOptions(fallbackSentences);
    return;
  }

  const primaryExamples = Array.isArray(selectedSense.examples) ? selectedSense.examples : [];
  if (primaryExamples.length) {
    renderSentenceOptions(primaryExamples);
    return;
  }

  renderSentenceOptions(fallbackSentences);
}

function renderSenseOptions(senses) {
  senseList.innerHTML = '';

  if (!senses.length) {
    senseList.innerHTML = '<p class="empty-state">No German meanings found for this word.</p>';
    selectedSense = null;
    updateSentenceChoices();
    return;
  }

  senses.forEach((item, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'choice-card';
    const firstExample = item.examples?.[0];
    card.innerHTML = `
      <strong>${escapeHtml(htmlToPlainText(item.translation))}</strong>
      <div class="muted">${escapeHtml(item.pos)}</div>
      ${firstExample ? `
        <div class="example-block">
          <div><strong>DE:</strong> ${escapeHtml(htmlToPlainText(firstExample.sentence))}</div>
          <div class="muted"><strong>EN:</strong> ${escapeHtml(htmlToPlainText(firstExample.sentence_translation || 'No translation available'))}</div>
        </div>
      ` : ''}
    `;

    card.addEventListener('click', () => {
      selectedSense = item;
      Array.from(senseList.children).forEach((element) => element.classList.remove('selected'));
      card.classList.add('selected');
      updateSentenceChoices();
    });

    if (index === 0) {
      selectedSense = item;
      card.classList.add('selected');
    }

    senseList.appendChild(card);
  });

  updateSentenceChoices();
}

async function openWordSheet(word) {
  currentEntry = { word };
  selectedSense = null;
  selectedSentence = null;
  fallbackSentences = [];
  sheetWordTitle.textContent = word;
  senseList.innerHTML = '<p class="empty-state">Loading meanings...</p>';
  sentenceList.innerHTML = '<p class="empty-state">Loading example sentences...</p>';
  setMessage(saveMessage, '');
  setMessage(sheetStatus, 'Loading…');
  openSheet();

  try {
    const [definitionsPayload, tatoebaExamples] = await Promise.all([
      fetchWiktionaryDefinitions(word),
      fetchTatoebaSentences(word).catch(() => []),
    ]);

    fallbackSentences = tatoebaExamples;

    const senses = normalizeSenses(word, definitionsPayload);
    renderSenseOptions(senses);

    if (!senses.length) {
      if (fallbackSentences.length) {
        setMessage(sheetStatus, 'No structured meaning found. You can still inspect sentence examples.', 'error');
      } else {
        setMessage(sheetStatus, 'No dictionary entry found for this word.', 'error');
      }
      return;
    }

    const hasNativeExamples = senses.some((item) => item.examples.length > 0);
    if (hasNativeExamples) {
      setMessage(sheetStatus, 'Meanings loaded from Wiktionary.', 'success');
    } else if (fallbackSentences.length) {
      setMessage(sheetStatus, 'Meanings loaded. Sentences are from Tatoeba fallback.', 'success');
    } else {
      setMessage(sheetStatus, 'Meanings loaded, but no example sentence was found.', 'success');
    }
  } catch (error) {
    senseList.innerHTML = '<p class="empty-state">Could not load meanings.</p>';
    sentenceList.innerHTML = '<p class="empty-state">Could not load example sentences.</p>';
    setMessage(sheetStatus, error.message, 'error');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(authMessage, '');

  const email = emailInput.value.trim();
  const password = document.getElementById('password').value;
  if (!email) {
    setMessage(authMessage, 'Enter your email address.', 'error');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log('signInWithPassword result:', data, error);

  if (error) {
    setMessage(authMessage, error.message, 'error');
    return;
  }

  setMessage(authMessage, 'Logged in successfully!', 'success');
  // Show user
  loginForm.classList.add('hidden');

});

signOutButton.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    setMessage(authMessage, error.message, 'error');
    return;
  }
  setMessage(authMessage, 'Signed out.', 'success');
  closeSheet();
});

searchWordInput.addEventListener('input', () => {
  const query = searchWordInput.value.trim();
  const requestToken = ++latestSearchToken;

  clearTimeout(searchTimer);
  searchResults.innerHTML = '';
  searchResults.classList.add('hidden');
  setMessage(searchMessage, '');

  if (query.length < 2) {
    return;
  }

  setMessage(searchMessage, 'Searching…');

  searchTimer = setTimeout(async () => {
    try {
      const results = await searchHeadwords(query);
      if (requestToken !== latestSearchToken) {
        return;
      }
      renderSearchResults(results);
      if (results.length) {
        setMessage(searchMessage, `${results.length} result${results.length === 1 ? '' : 's'} found.`, 'success');
      }
    } catch (error) {
      if (requestToken !== latestSearchToken) {
        return;
      }
      setMessage(searchMessage, error.message, 'error');
    }
  }, 250);
});

saveSelectedButton.addEventListener('click', async () => {
  setMessage(saveMessage, '');

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error('You are not signed in.');
    }

    if (!currentEntry?.word) {
      throw new Error('No word selected.');
    }

    if (!selectedSense) {
      throw new Error('Choose a meaning first.');
    }

    const payload = {
      user_id: user.id,
      word: currentEntry.word,
      translation: selectedSense.translation,
      pos: selectedSense.pos,
      sense: selectedSense.sense,
      sentence: selectedSentence?.sentence || '',
      sentence_translation: selectedSentence?.sentence_translation || '',
      source: selectedSentence?.source ? `wiktionary+${selectedSentence.source}` : 'wiktionary',
      uploaded: false,
    };

    const { error } = await supabase.from('words').insert(payload);
    if (error) {
      throw new Error(error.message);
    }

    setMessage(saveMessage, 'Word saved.', 'success');
    await loadWords();

    setTimeout(() => {
      closeSheet();
      searchWordInput.value = '';
      searchResults.innerHTML = '';
      searchResults.classList.add('hidden');
      setMessage(searchMessage, '');
    }, 350);
  } catch (error) {
    setMessage(saveMessage, error.message, 'error');
  }
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

closeSheetButton.addEventListener('click', closeSheet);
sheetBackdrop.addEventListener('click', closeSheet);

async function deleteWord(wordId) {
  const confirmed = window.confirm('Delete this word?');

  if (!confirmed) return;

  const { error } = await supabase
      .from('words')
      .delete()
      .eq('id', wordId);

  if (error) {
    throw new Error(error.message);
  }

  await loadWords();
}

refreshButton.addEventListener('click', async () => {
  await loadWords();
});

supabase.auth.onAuthStateChange((event, session) => {
  console.log('auth event:', event, session);
  updateAuthUI(session);

  if (session?.user) {
    setTimeout(() => {
      loadWords().catch(console.error);
    }, 0);
  }
});

updateAuthUI();
