import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Message } from '../../messages/entities/message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, default: 'New Conversation' })
  title: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Message, (msg) => msg.conversation)
  messages: Message[];
}
