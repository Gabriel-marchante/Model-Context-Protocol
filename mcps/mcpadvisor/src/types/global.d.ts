import { Pool } from 'mysql2/promise';

declare global {
  var obClient: Pool | undefined;
  var systemEnv: {
    hnswEfSearch?: number;
  };

  namespace NodeJS {
    interface ProcessEnv {
      OCEANBASE_URL?: string;
      DB_MAX_CONNECTIONS?: string;
      VECTOR_ENGINE_TYPE?: string;
      DEBUG?: string;
      ENABLE_FILE_LOGGING?: string;
      LOG_LEVEL?: string;
    }
  }
}
