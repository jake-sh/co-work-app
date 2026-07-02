export interface Dictionary {
  nav: {
    project: string;
    todo: string;
    memo: string;
    schedule: string;
    chat: string;
    settings: string;
  };
  auth: {
    login: string;
    signup: string;
    username: string;
    password: string;
    displayName: string;
    loginButton: string;
    signupButton: string;
    switchToSignup: string;
    switchToLogin: string;
    logout: string;
    colorAssigned: string;
    genericError: string;
    usernameTaken: string;
    autoLogin: string;
  };
  project: {
    title: string;
    create: string;
    name: string;
    description: string;
    members: string;
    addMember: string;
    period: string;
    startDate: string;
    endDate: string;
    save: string;
    cancel: string;
    noProjects: string;
    selectProject: string;
    overview: string;
    open: string;
    complete: string;
    reopen: string;
    delete: string;
    deleteConfirm: string;
    completed: string;
  };
  todo: {
    title: string;
    inputPlaceholder: string;
    add: string;
    statusNew: string;
    statusInProgress: string;
    statusDone: string;
    empty: string;
    selectProjectFirst: string;
  };
  memo: {
    title: string;
    newButton: string;
    newMemo: string;
    editMemo: string;
    titlePlaceholder: string;
    bodyPlaceholder: string;
    save: string;
    cancel: string;
    share: string;
    shared: string;
    delete: string;
    deleteConfirm: string;
    empty: string;
  };
  schedule: {
    title: string;
    addEvent: string;
    eventTitle: string;
    date: string;
    time: string;
    save: string;
    cancel: string;
    empty: string;
    fromMemo: string;
    fromTodo: string;
    today: string;
  };
  chat: {
    title: string;
    inputPlaceholder: string;
    empty: string;
  };
  settings: {
    title: string;
    language: string;
    korean: string;
    english: string;
    account: string;
    nickname: string;
    colorCode: string;
    memoDefaultShared: string;
    signOut: string;
  };
  common: {
    loading: string;
    back: string;
  };
}
