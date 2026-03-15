-- CreateTable: telegram_subscriptions
CREATE TABLE "telegram_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: gitlab_integrations
CREATE TABLE "gitlab_integrations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "gitlab_url" TEXT NOT NULL,
    "gitlab_token" TEXT NOT NULL,
    "webhook_token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gitlab_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_subscriptions_user_id_key" ON "telegram_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_integrations_project_id_key" ON "gitlab_integrations"("project_id");

-- AddForeignKey
ALTER TABLE "telegram_subscriptions" ADD CONSTRAINT "telegram_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_integrations" ADD CONSTRAINT "gitlab_integrations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
