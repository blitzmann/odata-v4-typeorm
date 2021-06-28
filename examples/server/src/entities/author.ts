import {Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn} from 'typeorm';
import {Post} from './post';
import {User} from './user';

@Entity('authors')
export class Author {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToMany(type => Post, post => post.author)
  posts: Post[];

  @ManyToOne(type => User)
  user: User;
}