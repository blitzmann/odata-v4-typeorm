import {Column, Entity, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {Post} from './post';

@Entity('documents')
export class Document {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

}