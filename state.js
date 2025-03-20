// state.js - Application state management

// Private state object
const _state = {
    page: null, // id of the last rendered page
    // Other state will be refactored here in future updates
};

// Page state management
export function getCurrentPage() {
    return _state.page;
}

export function setCurrentPage(pageId) {
    _state.page = pageId;
    return _state.page;
}

// Future state management functions will be added here 