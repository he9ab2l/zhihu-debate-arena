CREATE TABLE `debates` (
	`id` varchar(32) NOT NULL,
	`topic` varchar(160) NOT NULL,
	`source` enum('zhihu','demo') NOT NULL DEFAULT 'demo',
	`ownerOpenId` varchar(64),
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `debates_id` PRIMARY KEY(`id`)
);
