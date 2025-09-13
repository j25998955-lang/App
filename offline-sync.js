// offline-sync.js

const PENDING_POSTS_KEY = 'pending_posts';

/**
 * Guarda una nueva publicación en el almacenamiento local.
 * @param {object} post - El objeto de la publicación a guardar.
 */
export const savePostLocally = (post) => {
    const pendingPosts = getLocalPosts();
    pendingPosts.push(post);
    localStorage.setItem(PENDING_POSTS_KEY, JSON.stringify(pendingPosts));
};

/**
 * Obtiene todas las publicaciones pendientes del almacenamiento local.
 * @returns {Array<object>} - Un array de objetos de publicación.
 */
export const getLocalPosts = () => {
    const postsJson = localStorage.getItem(PENDING_POSTS_KEY);
    return postsJson ? JSON.parse(postsJson) : [];
};

/**
 * Limpia todas las publicaciones pendientes del almacenamiento local.
 */
export const clearLocalPosts = () => {
    localStorage.removeItem(PENDING_POSTS_KEY);
};
