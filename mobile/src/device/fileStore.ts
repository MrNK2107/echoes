import { Directory, File, Paths } from 'expo-file-system';

import type { FileStore } from './types';

export const outboxFiles: FileStore = {
  async persist(uri, name) {
    const outbox = new Directory(Paths.document, 'outbox');
    outbox.create({ intermediates: true, idempotent: true });
    const target = new File(outbox, name);
    await new File(uri).copy(target, { overwrite: true });
    return target.uri;
  },
  async remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
};
