import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {Document} from  './document'
@Entity('post_category')
export class PostCategory {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(type => Document)
  document: Document[];
}