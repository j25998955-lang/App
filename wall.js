import { supabase } from './supabase-client.js';
import { savePostLocally, getLocalPosts, clearLocalPosts } from './offline-sync.js';

// --- DOM Elements ---
const questionsContainer = document.getElementById('questions-container');
const questionForm = document.getElementById('question-form');
const questionContentInput = document.getElementById('question-text');
const questionImageInput = document.getElementById('question-image-upload');
const postQuestionBtn = document.getElementById('post-question-btn');
const confirmModal = document.getElementById('delete-confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const profileAvatarSmall = document.getElementById('profile-avatar-small');
const notificationBell = document.getElementById('notification-bell');
const notificationCount = document.getElementById('notification-count');
const notificationPanel = document.getElementById('notification-panel');
const syncIndicator = document.getElementById('sync-indicator');

// --- State ---
let deleteResolver = null;
let currentUser = null;
let currentPage = 0;
const PAGE_SIZE = 15; // Increased page size for a better feel
let isLoading = false;
let hasMore = true;

// --- HELPERS (OPTIMIZED) ---
const getOptimizedUrl = (bucket, path, options) => {
    // If path is missing, or it's already a full URL (placeholder or old data), return it directly.
    if (!path || path.startsWith('http')) return path;
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, {
        transform: options
    });

    // Add a timestamp to the URL to bypass browser cache, ensuring updates are visible
    return data.publicUrl ? `${data.publicUrl}&t=${new Date().getTime()}` : null;
};

const createAvatarElement = (avatarPath, username) => {
    const avatarImg = document.createElement('img');
    // Request a small, compressed avatar for performance
    const optimizedUrl = getOptimizedUrl('avatars', avatarPath, { width: 80, height: 80, quality: 75 });
    
    avatarImg.src = optimizedUrl || 'images/avatar-placeholder.png';
    avatarImg.alt = `Avatar de ${username || 'usuario'}`;
    avatarImg.className = 'post-avatar';
    avatarImg.loading = 'lazy'; // Defer loading of off-screen images
    return avatarImg;
};

// --- UI ---
const showImagePreview = (file) => {
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');

    if (file) {
        imagePreview.src = URL.createObjectURL(file);
        imagePreviewContainer.style.display = 'block';
    }

    removeImageBtn.onclick = () => {
        questionImageInput.value = '';
        imagePreviewContainer.style.display = 'none';
    };
};

const createAnswerElement = (answer) => {
    const answerDiv = document.createElement('div');
    answerDiv.className = 'answer';
    answerDiv.id = `answer-${answer.id}`;

    // Use the optimized avatar creation helper
    const avatarImg = createAvatarElement(answer.profiles?.avatar_url, answer.profiles?.username);

    const answerHeader = document.createElement('div');
    answerHeader.className = 'post-header';
    const answerHeaderInfo = document.createElement('div');
    answerHeaderInfo.className = 'post-header-info';

    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = answer.profiles?.username || 'Usuario';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'date';
    dateSpan.textContent = new Date(answer.created_at).toLocaleString();

    const answerContent = document.createElement('p');
    answerContent.textContent = answer.text || "";

    answerHeaderInfo.append(usernameSpan, dateSpan);
    answerHeader.append(avatarImg, answerHeaderInfo);
    answerDiv.append(answerHeader, answerContent);

    if (currentUser && answer.user_id === currentUser.id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.className = 'delete-btn icon-button';
        deleteBtn.onclick = () => handleDelete('answers', answer.id);
        answerHeader.appendChild(deleteBtn);
    }
    return answerDiv;
};

const createQuestionElement = (question, isPending = false) => {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'card';
    if (isPending) questionDiv.classList.add('is-pending');
    questionDiv.id = `question-${question.id}`;

    const postWrapper = document.createElement('div');
    postWrapper.className = 'post-wrapper';

    const avatarImg = createAvatarElement(question.profiles?.avatar_url, question.profiles?.username);
    
    const postHeader = document.createElement('div');
    postHeader.className = 'post-header';
    const postHeaderInfo = document.createElement('div');
    postHeaderInfo.className = 'post-header-info';
    const usernameSpan = document.createElement('span');
    usernameSpan.className = 'username';
    usernameSpan.textContent = question.profiles?.username || 'Usuario';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'date';
    dateSpan.textContent = new Date(question.created_at).toLocaleString();
    postHeaderInfo.append(usernameSpan, dateSpan);
    postHeader.append(avatarImg, postHeaderInfo);

    if (currentUser && question.user_id === currentUser.id) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="ph ph-trash"></i>';
        deleteBtn.className = 'delete-btn icon-button';
        deleteBtn.onclick = () => handleDelete('questions', question.id);
        postHeader.appendChild(deleteBtn);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'post-content';

    if (isPending) {
        const pendingIndicator = document.createElement('div');
        pendingIndicator.className = 'pending-indicator';
        pendingIndicator.innerHTML = `<i class="ph ph-clock"></i> Pendiente de sincronización`;
        contentDiv.appendChild(pendingIndicator);
    }

    const contentP = document.createElement('p');
    contentP.textContent = question.text || "";
    contentDiv.append(contentP);

    if (question.image_url) {
        const image = document.createElement('img');
        // Request a moderately sized, compressed version of the question image
        const optimizedImageUrl = getOptimizedUrl('question-images', question.image_url, { width: 600, quality: 80 });
        if (optimizedImageUrl) {
            image.src = optimizedImageUrl;
            image.alt = "Imagen de la pregunta";
            image.className = 'question-image';
            image.loading = 'lazy';
            contentDiv.appendChild(image);
        }
    }

    const answersDiv = document.createElement('div');
    answersDiv.className = 'answers-container';
    answersDiv.id = `answers-for-${question.id}`;
    if (Array.isArray(question.answers)) {
        question.answers.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        question.answers.forEach(answer => answersDiv.appendChild(createAnswerElement(answer)));
    }

    const answerForm = document.createElement('form');
    answerForm.className = 'answer-form';
    answerForm.onsubmit = (e) => {
        e.preventDefault();
        const answerContent = e.target.elements.answer.value;
        if (answerContent.trim()) {
            handlePostAnswer(question.id, answerContent);
            e.target.reset();
        }
    };
    answerForm.innerHTML = `
        <textarea name="answer" placeholder="Escribe tu respuesta..." required rows="2"></textarea>
        <div class="button-container">
            <button type="submit" class="button button-primary-solid button-small">Responder</button>
        </div>
    `;

    postWrapper.append(postHeader, contentDiv, answersDiv, answerForm);
    questionDiv.appendChild(postWrapper);
    return questionDiv;
};

const loadPendingPosts = () => {
    const pendingPosts = getLocalPosts();
    pendingPosts.forEach(post => {
        const tempId = `pending-${Date.now()}`;
        const postForUI = {
            ...post,
            id: tempId,
            created_at: new Date().toISOString(),
            profiles: { username: 'Tú (Pendiente)', avatar_url: profileAvatarSmall.src }
        };
        questionsContainer.prepend(createQuestionElement(postForUI, true));
    });
};

// --- DATA (PAGING IMPLEMENTED) ---
const loadQuestionsAndAnswers = async () => {
    if (isLoading || !hasMore) return;
    isLoading = true;

    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
        .from('questions')
        .select('*, profiles(username, avatar_url), answers(*, profiles(username, avatar_url))')
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error loading data:", error);
        isLoading = false;
        return;
    }

    if (data && data.length > 0) {
        data.forEach(question => {
            if (!document.getElementById(`question-${question.id}`)) {
                questionsContainer.appendChild(createQuestionElement(question));
            }
        });
        currentPage++;
    }

    if (!data || data.length < PAGE_SIZE) {
        hasMore = false;
    }

    isLoading = false;
};

const handlePostQuestion = async (event) => {
    event.preventDefault();
    postQuestionBtn.disabled = true;
    postQuestionBtn.textContent = 'Publicando...';
    const content = questionContentInput.value;
    const imageFile = questionImageInput.files[0];

    if (imageFile && !navigator.onLine) {
        alert('No puedes subir imágenes sin conexión. Conéctate a internet para subir la imagen.');
        postQuestionBtn.disabled = false;
        postQuestionBtn.textContent = 'Publicar';
        return;
    }

    if (!navigator.onLine) {
        const post = { text: content, user_id: currentUser.id };
        savePostLocally(post);
        loadPendingPosts(); // Refresh pending posts in UI
        questionForm.reset();
        document.getElementById('image-preview-container').style.display = 'none';
        postQuestionBtn.disabled = false;
        postQuestionBtn.textContent = 'Publicar';
        return;
    }

    try {
        let imagePath = null;
        if (imageFile) {
            const filePath = `${currentUser.id}/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await supabase.storage.from('question-images').upload(filePath, imageFile);
            if (uploadError) throw new Error(`Error en Subida: ${uploadError.message}`);
            imagePath = filePath;
        }

        const { data: newQuestion, error: insertError } = await supabase.from('questions').insert({
            text: content,
            image_url: imagePath,
            user_id: currentUser.id
        }).select('*, profiles(username, avatar_url), answers(*, profiles(username, avatar_url))').single();

        if (insertError) throw new Error(`Error en Inserción: ${insertError.message}`);

        if (newQuestion) {
            questionsContainer.prepend(createQuestionElement(newQuestion));
        }

        questionForm.reset();
        document.getElementById('image-preview-container').style.display = 'none';
    } catch (error) {
        alert(`Error al publicar: ${error.message}`);
    } finally {
        postQuestionBtn.disabled = false;
        postQuestionBtn.textContent = 'Publicar';
    }
};

const syncPendingPosts = async () => {
    const pendingPosts = getLocalPosts();
    if (pendingPosts.length === 0) return;

    syncIndicator.style.display = 'block';
    let allSucceeded = true;

    for (const post of pendingPosts) {
        try {
            const { error } = await supabase.from('questions').insert({ text: post.text, user_id: post.user_id });
            if (error) {
                allSucceeded = false;
                console.error('Error sincronizando post:', error);
            }
        } catch (error) {
            allSucceeded = false;
            console.error('Fallo en la sincronización:', error);
        }
    }

    syncIndicator.style.display = 'none';

    if (allSucceeded) {
        clearLocalPosts();
        // Full reload to ensure consistency
        questionsContainer.innerHTML = '';
        currentPage = 0;
        hasMore = true;
        await loadQuestionsAndAnswers();
    }
};

const handlePostAnswer = async (questionId, content) => {
    const { data: newAnswer, error } = await supabase.from('answers').insert({ 
        text: content, 
        question_id: questionId, 
        user_id: currentUser.id 
    }).select('*, profiles(username, avatar_url)').single();
    
    if (error) {
        console.error('Error publicando respuesta:', error);
        return;
    }
    
    if (newAnswer) {
        const answersContainer = document.getElementById(`answers-for-${questionId}`);
        if (answersContainer) {
            answersContainer.appendChild(createAnswerElement(newAnswer));
        }
    }
};

const handleDelete = async (table, id) => {
    confirmModal.style.display = 'flex';
    const userResponse = await new Promise(resolve => { deleteResolver = resolve; });
    confirmModal.style.display = 'none';
    deleteResolver = null;

    if (userResponse) {
        try {
            // If deleting a question with an image, remove the image from storage first
            if (table === 'questions') {
                const { data: question } = await supabase.from('questions').select('image_url').eq('id', id).single();
                if (question && question.image_url) {
                    await supabase.storage.from('question-images').remove([question.image_url]);
                }
            }

            const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
            if (deleteError) throw new Error(deleteError.message);

            // Optimistic UI: remove from view immediately
            const elementId = table === 'questions' ? `question-${id}` : `answer-${id}`;
            document.getElementById(elementId)?.remove();

        } catch (error) {
            alert(`No se pudo completar el borrado: ${error.message}`);
        }
    }
};

// --- NOTIFICATIONS (No changes from original) ---
const updateNotificationCount = (count) => { /* ... */ };
const loadInitialNotifications = async () => { /* ... */ };
const toggleNotificationPanel = async () => { /* ... */ };

// --- INIT & EVENT LISTENERS ---
const setupRealtime = () => {
    supabase.channel('public:answers').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, 
      async (payload) => {
        if (payload.new.user_id !== currentUser.id) {
            const { data: newAnswer } = await supabase.from('answers').select('*, profiles(username, avatar_url)').eq('id', payload.new.id).single();
            if(newAnswer) {
                const answersContainer = document.getElementById(`answers-for-${newAnswer.question_id}`);
                if (answersContainer && !document.getElementById(`answer-${newAnswer.id}`)) {
                    answersContainer.appendChild(createAnswerElement(newAnswer));
                }
            }
        }
      }).subscribe();

    supabase.channel(`notifications-for-${currentUser.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${currentUser.id}` }, 
        (payload) => {
            let currentCount = parseInt(notificationCount.textContent) || 0;
            if (notificationCount.style.display === 'none') currentCount = 0;
            updateNotificationCount(currentCount + 1);
        })
        .subscribe();

    supabase.channel('public:all-deletes').on('postgres_changes', { event: 'DELETE', schema: 'public' }, (payload) => {
        document.getElementById(`question-${payload.old.id}`)?.remove();
        document.getElementById(`answer-${payload.old.id}`)?.remove();
    }).subscribe();
};

const handleScroll = () => {
    // Load more content when user is 500px from the bottom
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadQuestionsAndAnswers();
    }
};

const initWallPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    
    const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).single();
    if (profileAvatarSmall && profile?.avatar_url) {
        const optimizedUrl = getOptimizedUrl('avatars', profile.avatar_url, { width: 80, height: 80, quality: 75 });
        if(optimizedUrl) profileAvatarSmall.src = optimizedUrl;
    }

    questionsContainer.innerHTML = '';
    currentPage = 0;
    hasMore = true;
    isLoading = false;

    loadPendingPosts();
    await loadQuestionsAndAnswers();
    await loadInitialNotifications();
    setupRealtime();

    window.addEventListener('scroll', handleScroll);
    notificationBell.addEventListener('click', toggleNotificationPanel);
    window.addEventListener('online', syncPendingPosts);
};

if (questionForm) questionForm.addEventListener('submit', handlePostQuestion);
if (questionImageInput) questionImageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) showImagePreview(e.target.files[0]);
});
if (confirmDeleteBtn && cancelDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => deleteResolver?.(true));
    cancelDeleteBtn.addEventListener('click', () => deleteResolver?.(false));
}
document.addEventListener('DOMContentLoaded', initWallPage);
