-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'TRIAL', 'MONTHLY', 'ANNUAL', 'GIFTED');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('TRACKING', 'OFFER_PENDING', 'OFFER_ACCEPTED', 'CONSIGNED', 'LISTED', 'SOLD', 'TRADE_LISTED', 'IN_TRADE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "username" TEXT,
    "displayName" TEXT,
    "passwordHash" TEXT,
    "planTier" "PlanTier" NOT NULL DEFAULT 'FREE',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeConnectId" TEXT,
    "profilePhoto" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" TIMESTAMP(3),
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "trainingConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "coverImage" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'inbound',
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerId" TEXT,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_scrape_queue" (
    "id" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "sport" TEXT,
    "tcdbSetId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'monitor',
    "status" TEXT NOT NULL DEFAULT 'announced',
    "releaseDate" TIMESTAMP(3),
    "checkCount" INTEGER NOT NULL DEFAULT 0,
    "lastChecked" TIMESTAMP(3),
    "tcdbCardCount" INTEGER,
    "tcdbImagesFound" INTEGER NOT NULL DEFAULT 0,
    "imageThreshold" INTEGER NOT NULL DEFAULT 70,
    "cardCount" INTEGER,
    "scrapedCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "set_scrape_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_examples" (
    "id" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grader" TEXT,
    "certNumber" TEXT,
    "player" TEXT,
    "year" INTEGER,
    "manufacturer" TEXT,
    "set" TEXT,
    "subset" TEXT,
    "cardNumber" TEXT,
    "grade" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_snapshots" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "cardCount" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_collections" (
    "cardId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_collections_pkey" PRIMARY KEY ("cardId","collectionId")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "subset" TEXT,
    "cardNumber" TEXT,
    "serialNumber" TEXT,
    "sport" TEXT,
    "team" TEXT,
    "notes" TEXT,
    "grade" TEXT,
    "gradeCompany" TEXT,
    "certNumber" TEXT,
    "tags" TEXT[],
    "conditionNotes" TEXT,
    "photos" TEXT[],
    "estimatedValue" DECIMAL(10,2),
    "lastValueUpdate" TIMESTAMP(3),
    "acquiredDate" TIMESTAMP(3),
    "acquiredPrice" DECIMAL(10,2),
    "acquiredSource" TEXT,
    "bgsSubCentering" DECIMAL(4,1),
    "bgsSubCorners" DECIMAL(4,1),
    "bgsSubEdges" DECIMAL(4,1),
    "bgsSubSurface" DECIMAL(4,1),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isTradeable" BOOLEAN NOT NULL DEFAULT false,
    "status" "CardStatus" NOT NULL DEFAULT 'TRACKING',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cardId" TEXT,
    "collectionId" TEXT,
    "feedPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_follows" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "collection_follows" (
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_follows_pkey" PRIMARY KEY ("userId","collectionId")
);

-- CreateTable
CREATE TABLE "card_watches" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceAtWatch" DECIMAL(10,2),

    CONSTRAINT "card_watches_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "site_credentials" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_links" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_pages" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "consignment_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receiptCode" TEXT,
    "receivedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "returnName" TEXT,
    "returnPhone" TEXT,
    "returnAddressLine1" TEXT,
    "returnAddressLine2" TEXT,
    "returnCity" TEXT,
    "returnState" TEXT,
    "returnZip" TEXT,
    "returnCountry" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignment_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cardId" TEXT,
    "player" TEXT NOT NULL,
    "year" INTEGER,
    "cardNumber" TEXT,
    "manufacturer" TEXT,
    "set" TEXT,
    "subset" TEXT,
    "sport" TEXT,
    "graded" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "gradeCompany" TEXT,
    "certNumber" TEXT,
    "numbered" BOOLEAN NOT NULL DEFAULT false,
    "serialNumber" TEXT,
    "autographed" BOOLEAN NOT NULL DEFAULT false,
    "condition" TEXT,
    "notes" TEXT,
    "team" TEXT,
    "league" TEXT,
    "season" TEXT,
    "parallel" TEXT,
    "features" TEXT[],
    "cardName" TEXT,
    "cardType" TEXT,
    "cardSize" TEXT,
    "countryOfOrigin" TEXT DEFAULT 'United States',
    "upc" TEXT,
    "signedBy" TEXT,
    "autographAuthentication" TEXT,
    "autographAuthNumber" TEXT,
    "autographFormat" TEXT,
    "askingPrice" DECIMAL(10,2),
    "estimatedValue" DECIMAL(10,2),
    "photos" TEXT[],
    "listingType" TEXT,
    "desiredPrice" DECIMAL(10,2),
    "allowOffers" BOOLEAN NOT NULL DEFAULT false,
    "minimumOffer" DECIMAL(10,2),
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "consignment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebay_listings" (
    "id" TEXT NOT NULL,
    "consignmentItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "startPrice" DECIMAL(10,2) NOT NULL,
    "buyItNowPrice" DECIMAL(10,2),
    "ebayListingId" TEXT,
    "url" TEXT,
    "condition" TEXT,
    "team" TEXT,
    "league" TEXT,
    "season" TEXT,
    "parallel" TEXT,
    "features" TEXT[],
    "cardName" TEXT,
    "cardType" TEXT,
    "cardSize" TEXT,
    "countryOfOrigin" TEXT,
    "upc" TEXT,
    "signedBy" TEXT,
    "autographAuthentication" TEXT,
    "autographAuthNumber" TEXT,
    "autographFormat" TEXT,
    "allowOffers" BOOLEAN NOT NULL DEFAULT false,
    "minimumOffer" DECIMAL(10,2),
    "autoAcceptOffer" DECIMAL(10,2),
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "auctionDuration" INTEGER DEFAULT 7,
    "categoryId" TEXT DEFAULT '261328',
    "playerOverride" TEXT,
    "yearOverride" INTEGER,
    "manufacturerOverride" TEXT,
    "setOverride" TEXT,
    "cardNumberOverride" TEXT,
    "listingType" TEXT DEFAULT 'auction',
    "autographedEbay" BOOLEAN,
    "reservePrice" DECIMAL(10,2),
    "material" TEXT DEFAULT 'Card Stock',
    "scheduledTime" TIMESTAMP(3),
    "privateListing" BOOLEAN NOT NULL DEFAULT false,
    "shippingMethod" TEXT DEFAULT 'Standard shipping: Small to medium items',
    "shippingCostType" TEXT DEFAULT 'Calculated: Cost varies based on buyer location',
    "flatRateShipping" DECIMAL(10,2),
    "excludedLocations" TEXT[],
    "combinedShippingRule" TEXT DEFAULT '',
    "weightLbs" INTEGER DEFAULT 0,
    "weightOz" DECIMAL(5,1) DEFAULT 3,
    "dimLength" DECIMAL(5,1) DEFAULT 11.0,
    "dimWidth" DECIMAL(5,1) DEFAULT 6.0,
    "dimHeight" DECIMAL(5,1) DEFAULT 1.0,
    "conditionType" TEXT,
    "gradeCompanyEbay" TEXT,
    "gradeEbay" TEXT,
    "certNumberEbay" TEXT,
    "cardCondition" TEXT,
    "sport" TEXT,
    "vintage" BOOLEAN NOT NULL DEFAULT false,
    "eventTournament" TEXT,
    "language" TEXT DEFAULT 'English',
    "originalOrLicensed" TEXT DEFAULT 'Original',
    "californiaProp65" TEXT,
    "cardThickness" TEXT DEFAULT '35 pt.',
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "insertSet" TEXT,
    "printRun" TEXT,
    "customSpecifics" JSONB,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "listedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "soldPrice" DECIMAL(10,2),
    "ebayOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "buyerName" TEXT,
    "buyerAddress" JSONB,
    "shippingLabelUrl" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ebay_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_listings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "collectionCardId" TEXT,
    "consignmentItemId" TEXT,
    "sellerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photos" TEXT[],
    "player" TEXT NOT NULL,
    "year" INTEGER,
    "manufacturer" TEXT,
    "set" TEXT,
    "grade" TEXT,
    "gradeCompany" TEXT,
    "condition" TEXT,
    "sport" TEXT,
    "graded" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "listedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "soldPrice" DECIMAL(10,2),
    "ebayListingId" TEXT,
    "ebayUrl" TEXT,

    CONSTRAINT "exchange_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_listings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "player" TEXT NOT NULL,
    "year" INTEGER,
    "manufacturer" TEXT,
    "set" TEXT,
    "subset" TEXT,
    "cardNumber" TEXT,
    "sport" TEXT,
    "team" TEXT,
    "league" TEXT,
    "season" TEXT,
    "parallel" TEXT,
    "features" TEXT[],
    "graded" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "gradeCompany" TEXT,
    "certNumber" TEXT,
    "numbered" BOOLEAN NOT NULL DEFAULT false,
    "serialNumber" TEXT,
    "autographed" BOOLEAN NOT NULL DEFAULT false,
    "signedBy" TEXT,
    "autographAuthentication" TEXT,
    "autographAuthNumber" TEXT,
    "autographFormat" TEXT,
    "condition" TEXT,
    "photos" TEXT[],
    "notes" TEXT,
    "purchasePrice" DECIMAL(10,2),
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "startPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "buyItNowPrice" DECIMAL(10,2),
    "reservePrice" DECIMAL(10,2),
    "listingType" TEXT NOT NULL DEFAULT 'auction',
    "auctionDuration" INTEGER NOT NULL DEFAULT 7,
    "categoryId" TEXT NOT NULL DEFAULT '261328',
    "freeShipping" BOOLEAN NOT NULL DEFAULT true,
    "allowOffers" BOOLEAN NOT NULL DEFAULT false,
    "minimumOffer" DECIMAL(10,2),
    "autoAcceptOffer" DECIMAL(10,2),
    "flatRateShipping" DECIMAL(10,2),
    "shippingMethod" TEXT NOT NULL DEFAULT 'Standard shipping: Small to medium items',
    "shippingCostType" TEXT NOT NULL DEFAULT 'Calculated: Cost varies based on buyer location',
    "excludedLocations" TEXT[],
    "combinedShippingRule" TEXT NOT NULL DEFAULT '',
    "weightLbs" INTEGER NOT NULL DEFAULT 0,
    "weightOz" DECIMAL(5,1) NOT NULL DEFAULT 3,
    "dimLength" DECIMAL(5,1) NOT NULL DEFAULT 11.0,
    "dimWidth" DECIMAL(5,1) NOT NULL DEFAULT 6.0,
    "dimHeight" DECIMAL(5,1) NOT NULL DEFAULT 1.0,
    "privateListing" BOOLEAN NOT NULL DEFAULT false,
    "scheduledTime" TIMESTAMP(3),
    "material" TEXT NOT NULL DEFAULT 'Card Stock',
    "conditionType" TEXT,
    "gradeCompanyEbay" TEXT,
    "gradeEbay" TEXT,
    "certNumberEbay" TEXT,
    "cardCondition" TEXT,
    "cardName" TEXT,
    "cardType" TEXT,
    "cardSize" TEXT,
    "countryOfOrigin" TEXT,
    "upc" TEXT,
    "vintage" BOOLEAN NOT NULL DEFAULT false,
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'English',
    "originalOrLicensed" TEXT NOT NULL DEFAULT 'Original',
    "californiaProp65" TEXT,
    "cardThickness" TEXT NOT NULL DEFAULT '35 pt.',
    "insertSet" TEXT,
    "printRun" TEXT,
    "autographedEbay" BOOLEAN,
    "customSpecifics" JSONB,
    "eventTournament" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ebayListingId" TEXT,
    "url" TEXT,
    "listedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "soldPrice" DECIMAL(10,2),
    "lastError" TEXT,
    "ebayOrderId" TEXT,
    "paidAt" TIMESTAMP(3),
    "buyerName" TEXT,
    "buyerAddress" JSONB,
    "shippingLabelUrl" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),

    CONSTRAINT "internal_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" TEXT,
    "targetId" TEXT,
    "targetType" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_layouts" (
    "id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT,
    "caption" TEXT,
    "photos" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_training_samples" (
    "id" TEXT NOT NULL,
    "beforeThumb" TEXT NOT NULL,
    "afterThumb" TEXT NOT NULL,
    "cx" DOUBLE PRECISION NOT NULL,
    "cy" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_training_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebay_sent_replies" (
    "id" TEXT NOT NULL,
    "parentMessageId" TEXT NOT NULL,
    "itemId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebay_sent_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebay_feedback_alerts" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "commentType" TEXT NOT NULL,
    "commentingUser" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "commentTime" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebay_feedback_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "currentRevisionId" TEXT,
    "initiatorInboundTracking" TEXT,
    "initiatorInboundReceivedAt" TIMESTAMP(3),
    "targetInboundTracking" TEXT,
    "targetInboundReceivedAt" TIMESTAMP(3),
    "initiatorOutboundLabelUrl" TEXT,
    "initiatorOutboundTracking" TEXT,
    "initiatorOutboundShippedAt" TIMESTAMP(3),
    "initiatorReceivedAt" TIMESTAMP(3),
    "targetOutboundLabelUrl" TEXT,
    "targetOutboundTracking" TEXT,
    "targetOutboundShippedAt" TIMESTAMP(3),
    "targetReceivedAt" TIMESTAMP(3),
    "disputeOpenedById" TEXT,
    "disputeReason" TEXT,
    "disputeOpenedAt" TIMESTAMP(3),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_revisions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "message" TEXT,

    CONSTRAINT "trade_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_revision_cards" (
    "revisionId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "side" TEXT NOT NULL,

    CONSTRAINT "trade_revision_cards_pkey" PRIMARY KEY ("revisionId","cardId")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeConnectId_key" ON "users"("stripeConnectId");

-- CreateIndex
CREATE INDEX "collections_ownerId_idx" ON "collections"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "collections_ownerId_slug_key" ON "collections"("ownerId", "slug");

-- CreateIndex
CREATE INDEX "email_threads_status_idx" ON "email_threads"("status");

-- CreateIndex
CREATE INDEX "email_threads_fromEmail_idx" ON "email_threads"("fromEmail");

-- CreateIndex
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");

-- CreateIndex
CREATE INDEX "set_scrape_queue_status_idx" ON "set_scrape_queue"("status");

-- CreateIndex
CREATE INDEX "set_scrape_queue_year_idx" ON "set_scrape_queue"("year");

-- CreateIndex
CREATE INDEX "training_examples_source_idx" ON "training_examples"("source");

-- CreateIndex
CREATE INDEX "training_examples_verified_idx" ON "training_examples"("verified");

-- CreateIndex
CREATE INDEX "collection_snapshots_collectionId_capturedAt_idx" ON "collection_snapshots"("collectionId", "capturedAt");

-- CreateIndex
CREATE INDEX "cards_ownerId_idx" ON "cards"("ownerId");

-- CreateIndex
CREATE INDEX "cards_isTradeable_idx" ON "cards"("isTradeable");

-- CreateIndex
CREATE INDEX "comments_cardId_idx" ON "comments"("cardId");

-- CreateIndex
CREATE INDEX "comments_collectionId_idx" ON "comments"("collectionId");

-- CreateIndex
CREATE INDEX "comments_feedPostId_idx" ON "comments"("feedPostId");

-- CreateIndex
CREATE INDEX "user_follows_followingId_idx" ON "user_follows"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "site_credentials_service_key" ON "site_credentials"("service");

-- CreateIndex
CREATE UNIQUE INDEX "site_links_key_key" ON "site_links"("key");

-- CreateIndex
CREATE INDEX "site_links_section_idx" ON "site_links"("section");

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_path_key" ON "site_pages"("path");

-- CreateIndex
CREATE INDEX "site_pages_order_idx" ON "site_pages"("order");

-- CreateIndex
CREATE UNIQUE INDEX "consignment_orders_receiptCode_key" ON "consignment_orders"("receiptCode");

-- CreateIndex
CREATE INDEX "consignment_orders_userId_idx" ON "consignment_orders"("userId");

-- CreateIndex
CREATE INDEX "consignment_orders_status_idx" ON "consignment_orders"("status");

-- CreateIndex
CREATE INDEX "consignment_items_orderId_idx" ON "consignment_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ebay_listings_consignmentItemId_key" ON "ebay_listings"("consignmentItemId");

-- CreateIndex
CREATE INDEX "exchange_listings_status_idx" ON "exchange_listings"("status");

-- CreateIndex
CREATE INDEX "exchange_listings_player_idx" ON "exchange_listings"("player");

-- CreateIndex
CREATE INDEX "exchange_listings_sport_idx" ON "exchange_listings"("sport");

-- CreateIndex
CREATE INDEX "activity_logs_category_createdAt_idx" ON "activity_logs"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_level_createdAt_idx" ON "activity_logs"("level", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE INDEX "articles_status_publishedAt_idx" ON "articles"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "page_layouts_page_order_idx" ON "page_layouts"("page", "order");

-- CreateIndex
CREATE UNIQUE INDEX "page_layouts_page_widgetKey_key" ON "page_layouts"("page", "widgetKey");

-- CreateIndex
CREATE INDEX "feed_posts_userId_createdAt_idx" ON "feed_posts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feed_posts_cardId_idx" ON "feed_posts"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "photo_training_samples_sourcePath_key" ON "photo_training_samples"("sourcePath");

-- CreateIndex
CREATE INDEX "photo_training_samples_category_createdAt_idx" ON "photo_training_samples"("category", "createdAt");

-- CreateIndex
CREATE INDEX "ebay_sent_replies_sentAt_idx" ON "ebay_sent_replies"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "ebay_feedback_alerts_feedbackId_key" ON "ebay_feedback_alerts"("feedbackId");

-- CreateIndex
CREATE INDEX "ebay_feedback_alerts_resolvedAt_idx" ON "ebay_feedback_alerts"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "trades_currentRevisionId_key" ON "trades"("currentRevisionId");

-- CreateIndex
CREATE INDEX "trades_initiatorId_idx" ON "trades"("initiatorId");

-- CreateIndex
CREATE INDEX "trades_targetId_idx" ON "trades"("targetId");

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trade_revisions_tradeId_idx" ON "trade_revisions"("tradeId");

-- CreateIndex
CREATE INDEX "trade_revision_cards_cardId_idx" ON "trade_revision_cards"("cardId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_snapshots" ADD CONSTRAINT "collection_snapshots_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_collections" ADD CONSTRAINT "card_collections_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_collections" ADD CONSTRAINT "card_collections_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_feedPostId_fkey" FOREIGN KEY ("feedPostId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_follows" ADD CONSTRAINT "collection_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_follows" ADD CONSTRAINT "collection_follows_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_watches" ADD CONSTRAINT "card_watches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_watches" ADD CONSTRAINT "card_watches_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_orders" ADD CONSTRAINT "consignment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_items" ADD CONSTRAINT "consignment_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "consignment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_items" ADD CONSTRAINT "consignment_items_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebay_listings" ADD CONSTRAINT "ebay_listings_consignmentItemId_fkey" FOREIGN KEY ("consignmentItemId") REFERENCES "consignment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_listings" ADD CONSTRAINT "exchange_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_revisions" ADD CONSTRAINT "trade_revisions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_revisions" ADD CONSTRAINT "trade_revisions_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_revision_cards" ADD CONSTRAINT "trade_revision_cards_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "trade_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_revision_cards" ADD CONSTRAINT "trade_revision_cards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

